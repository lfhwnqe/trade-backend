import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import { SVGElementExtractorService } from './services/svg-element-extractor.service';
import { DataTransformService } from './services/data-transform.service';
import { ValidationService } from './services/validation.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { LoggingService, LogContext } from './services/logging.service';
import {
  SVGParseRequest,
  SVGParseResponse,
  ParseOptions,
  GraphData,
  ParseError,
  PerformanceMetrics,
} from './types';
import {
  SVGParserException,
  InvalidSVGFormatException,
  SVGParseTimeoutException,
  SVGFileTooLargeException,
  TooManyNodesException,
  URLFetchException,
  DataTransformException,
} from './exceptions/svg-parser.exceptions';

@Injectable()
export class SVGParserService {
  private readonly logger = new Logger(SVGParserService.name);

  constructor(
    private readonly elementExtractor: SVGElementExtractorService,
    private readonly dataTransform: DataTransformService,
    private readonly validation: ValidationService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * 解析SVG内容
   */
  async parseSVG(request: SVGParseRequest): Promise<SVGParseResponse> {
    const startTime = Date.now();
    const errors: ParseError[] = [];
    let svgContent: string;

    try {
      // 性能监控开始
      this.performanceMonitor.startMonitoring();

      // 获取SVG内容
      svgContent = await this.getSVGContent(request.input, request.inputType);

      // 验证SVG格式
      const validationResult =
        await this.validation.validateSVGFormat(svgContent);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        if (validationResult.errors.some((e) => e.severity === 'error')) {
          return this.createErrorResponse(errors, startTime);
        }
      }

      // 解析选项
      const options = this.mergeDefaultOptions(request.options);

      // 检查是否应该中断解析（仅在处理大量数据时检查）
      const elapsed = Date.now() - startTime;
      if (elapsed > 100) {
        // 只有在处理超过100ms时才检查
        const abortCheck = this.performanceMonitor.checkShouldAbort(
          startTime,
          options,
        );
        if (abortCheck.shouldAbort) {
          throw new SVGParseTimeoutException(options.timeout);
        }
      }

      // 解析SVG DOM
      const dom = this.createDOM(svgContent);
      const svgElement = dom.window.document.querySelector('svg');

      if (!svgElement) {
        throw new Error('未找到有效的SVG元素');
      }

      // 提取SVG元素
      const parsedData = await this.elementExtractor.extractElements(
        svgElement,
        options,
      );

      // 验证节点数量限制
      if (parsedData.nodes.length > options.maxNodes) {
        errors.push({
          code: 'MAX_NODES_EXCEEDED',
          message: `节点数量(${parsedData.nodes.length})超过限制(${options.maxNodes})`,
          severity: 'warning',
        });
      }

      // 转换为图数据模型
      const graphData =
        await this.dataTransform.transformToGraphData(parsedData);

      // 获取性能指标
      const metrics = this.performanceMonitor.getMetrics(startTime, graphData);

      this.logger.log(
        `SVG解析完成: 节点${graphData.nodes.length}个, 边${graphData.edges.length}个, 耗时${metrics.parseTime}ms`,
      );

      return {
        success: true,
        data: graphData,
        errors,
        metrics,
      };
    } catch (error) {
      this.logger.error(`SVG解析失败: ${error.message}`, error.stack);

      errors.push({
        code: 'PARSE_ERROR',
        message: error.message,
        severity: 'error',
      });

      return this.createErrorResponse(errors, startTime);
    }
  }

  /**
   * 验证SVG格式
   */
  async validateSVG(
    svgContent: string,
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const result = await this.validation.validateSVGFormat(svgContent);
      return {
        valid: result.valid,
        errors: result.errors
          .filter((e: any) => e.severity === 'error')
          .map((e: any) => e.message),
        warnings: result.errors
          .filter((e: any) => e.severity === 'warning')
          .map((e: any) => e.message),
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * 获取SVG内容
   */
  private async getSVGContent(input: any, inputType: string): Promise<string> {
    switch (inputType) {
      case 'url':
        return this.fetchSVGFromUrl(input as string);
      case 'string':
        return input as string;
      case 'file':
        return input as string; // 文件内容已经在controller中转换为字符串
      default:
        throw new URLFetchException(input, `不支持的输入类型: ${inputType}`);
    }
  }

  /**
   * 从URL获取SVG内容
   */
  private async fetchSVGFromUrl(url: string): Promise<string> {
    try {
      // 检查是否是 Whimsical URL，需要特殊处理
      if (url.includes('whimsical.com') && url.includes('/svg')) {
        return await this.fetchWhimsicalSVG(url);
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SVGParser/1.0)',
          Accept: 'image/svg+xml,text/xml,application/xml,text/html,*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      const content = await response.text();

      // 检查内容是否包含 SVG
      if (content.includes('<svg')) {
        // 如果是 HTML 页面，尝试提取 SVG 内容
        if (contentType?.includes('text/html')) {
          return this.extractSVGFromHTML(content);
        }
        return content;
      }

      if (
        contentType &&
        !contentType.includes('image/svg+xml') &&
        !contentType.includes('text/xml') &&
        !contentType.includes('text/html')
      ) {
        this.logger.warn(`可能不是SVG文件，Content-Type: ${contentType}`);
      }

      return content;
    } catch (error) {
      throw new Error(`获取SVG内容失败: ${error.message}`);
    }
  }

  /**
   * 处理 Whimsical SVG URL
   */
  private async fetchWhimsicalSVG(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/svg+xml,text/xml,application/xml,text/html,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Whimsical HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const content = await response.text();

      // 如果直接返回 SVG，直接使用
      if (content.trim().startsWith('<svg')) {
        return content;
      }

      // 如果是 HTML 页面，尝试提取 SVG
      if (content.includes('<svg')) {
        return this.extractSVGFromHTML(content);
      }

      throw new Error('未找到有效的SVG内容');
    } catch (error) {
      throw new Error(`获取Whimsical SVG失败: ${error.message}`);
    }
  }

  /**
   * 从HTML中提取SVG内容
   */
  private extractSVGFromHTML(html: string): string {
    try {
      // 使用正则表达式提取 SVG 内容
      const svgMatch = html.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        return svgMatch[0];
      }

      // 如果没有找到完整的 SVG 标签，尝试查找内联 SVG
      const svgStartMatch = html.match(/<svg[^>]*>/i);
      if (svgStartMatch) {
        const startIndex = html.indexOf(svgStartMatch[0]);
        const endIndex = html.lastIndexOf('</svg>');
        if (endIndex > startIndex) {
          return html.substring(startIndex, endIndex + 6);
        }
      }

      throw new Error('HTML中未找到有效的SVG内容');
    } catch (error) {
      throw new Error(`提取SVG内容失败: ${error.message}`);
    }
  }

  /**
   * 创建DOM对象
   */
  private createDOM(svgContent: string): JSDOM {
    try {
      return new JSDOM(svgContent, {
        contentType: 'text/html',
      });
    } catch (error) {
      throw new Error(`创建DOM失败: ${error.message}`);
    }
  }

  /**
   * 合并默认选项
   */
  private mergeDefaultOptions(options?: Partial<ParseOptions>): ParseOptions {
    return {
      extractText: true,
      extractStyles: true,
      extractTransforms: true,
      ignoreHiddenElements: true,
      maxNodes: 1000,
      timeout: 30000,
      validateStructure: true,
      ...options,
    };
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(
    errors: ParseError[],
    startTime: number,
  ): SVGParseResponse {
    const metrics: PerformanceMetrics = {
      parseTime: Date.now() - startTime,
      memoryUsage: process.memoryUsage().heapUsed,
      nodeCount: 0,
      edgeCount: 0,
      elementCount: 0,
    };

    return {
      success: false,
      errors,
      metrics,
    };
  }
}

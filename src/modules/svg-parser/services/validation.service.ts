import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { ParseError } from '../types';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * 验证SVG格式
   */
  async validateSVGFormat(
    svgContent: string,
  ): Promise<{ valid: boolean; errors: ParseError[] }> {
    const errors: ParseError[] = [];

    try {
      // 基础格式检查
      this.validateBasicFormat(svgContent, errors);

      // XML格式验证
      await this.validateXMLFormat(svgContent, errors);

      // SVG结构验证
      await this.validateSVGStructure(svgContent, errors);

      // 内容验证
      await this.validateSVGContent(svgContent, errors);

      const hasErrors = errors.some((error) => error.severity === 'error');

      this.logger.log(
        `SVG验证完成: ${hasErrors ? '失败' : '成功'}, 错误${errors.length}个`,
      );

      return {
        valid: !hasErrors,
        errors,
      };
    } catch (error) {
      this.logger.error(`SVG验证异常: ${error.message}`, error.stack);

      errors.push({
        code: 'VALIDATION_ERROR',
        message: `验证过程异常: ${error.message}`,
        severity: 'error',
      });

      return {
        valid: false,
        errors,
      };
    }
  }

  /**
   * 基础格式检查
   */
  private validateBasicFormat(svgContent: string, errors: ParseError[]): void {
    // 检查是否为空
    if (!svgContent || svgContent.trim().length === 0) {
      errors.push({
        code: 'EMPTY_CONTENT',
        message: 'SVG内容为空',
        severity: 'error',
      });
      return;
    }

    // 检查是否包含SVG标签
    if (!svgContent.includes('<svg')) {
      errors.push({
        code: 'NO_SVG_TAG',
        message: '未找到SVG标签',
        severity: 'error',
      });
    }

    // 检查基本的XML结构
    const openTags = (svgContent.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (svgContent.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (svgContent.match(/<[^>]*\/>/g) || []).length;

    if (openTags !== closeTags + selfClosingTags) {
      errors.push({
        code: 'UNMATCHED_TAGS',
        message: '标签不匹配',
        severity: 'warning',
      });
    }

    // 检查文件大小
    const sizeInMB = Buffer.byteLength(svgContent, 'utf8') / (1024 * 1024);
    if (sizeInMB > 10) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `文件过大: ${sizeInMB.toFixed(2)}MB`,
        severity: 'warning',
      });
    }
  }

  /**
   * XML格式验证
   */
  private async validateXMLFormat(
    svgContent: string,
    errors: ParseError[],
  ): Promise<void> {
    try {
      const dom = new JSDOM(svgContent, {
        contentType: 'image/svg+xml',
      });

      const parseErrors = dom.window.document.querySelectorAll('parsererror');
      if (parseErrors.length > 0) {
        parseErrors.forEach((error, index) => {
          errors.push({
            code: 'XML_PARSE_ERROR',
            message: `XML解析错误 ${index + 1}: ${error.textContent}`,
            severity: 'error',
          });
        });
      }
    } catch (error) {
      errors.push({
        code: 'XML_INVALID',
        message: `XML格式无效: ${error.message}`,
        severity: 'error',
      });
    }
  }

  /**
   * SVG结构验证
   */
  private async validateSVGStructure(
    svgContent: string,
    errors: ParseError[],
  ): Promise<void> {
    try {
      const dom = new JSDOM(svgContent, {
        contentType: 'image/svg+xml',
      });

      const svgElement = dom.window.document.querySelector('svg');

      if (!svgElement) {
        errors.push({
          code: 'NO_SVG_ELEMENT',
          message: '未找到SVG根元素',
          severity: 'error',
        });
        return;
      }

      // 检查SVG命名空间
      const xmlns = svgElement.getAttribute('xmlns');
      if (!xmlns || xmlns !== 'http://www.w3.org/2000/svg') {
        errors.push({
          code: 'INVALID_NAMESPACE',
          message: 'SVG命名空间无效或缺失',
          severity: 'warning',
        });
      }

      // 检查viewBox或尺寸
      const viewBox = svgElement.getAttribute('viewBox');
      const width = svgElement.getAttribute('width');
      const height = svgElement.getAttribute('height');

      if (!viewBox && (!width || !height)) {
        errors.push({
          code: 'NO_DIMENSIONS',
          message: '缺少viewBox或width/height属性',
          severity: 'warning',
        });
      }

      // 验证viewBox格式
      if (viewBox) {
        const viewBoxValues = viewBox.split(/\s+/);
        if (
          viewBoxValues.length !== 4 ||
          viewBoxValues.some((v) => isNaN(Number(v)))
        ) {
          errors.push({
            code: 'INVALID_VIEWBOX',
            message: 'viewBox格式无效',
            severity: 'error',
          });
        }
      }

      // 检查是否有内容元素
      const contentElements = svgElement.querySelectorAll(
        'rect, circle, ellipse, line, polyline, polygon, path, text, g',
      );
      if (contentElements.length === 0) {
        errors.push({
          code: 'NO_CONTENT',
          message: 'SVG中没有可见内容元素',
          severity: 'warning',
        });
      }
    } catch (error) {
      errors.push({
        code: 'STRUCTURE_VALIDATION_ERROR',
        message: `结构验证失败: ${error.message}`,
        severity: 'error',
      });
    }
  }

  /**
   * SVG内容验证
   */
  private async validateSVGContent(
    svgContent: string,
    errors: ParseError[],
  ): Promise<void> {
    try {
      const dom = new JSDOM(svgContent, {
        contentType: 'image/svg+xml',
      });

      const svgElement = dom.window.document.querySelector('svg');
      if (!svgElement) return;

      // 验证路径数据
      const paths = svgElement.querySelectorAll('path');
      paths.forEach((path, index) => {
        const d = path.getAttribute('d');
        if (d && !this.isValidPathData(d)) {
          errors.push({
            code: 'INVALID_PATH_DATA',
            message: `路径 ${index + 1} 的d属性无效`,
            element: `path[${index}]`,
            severity: 'warning',
          });
        }
      });

      // 验证颜色值
      const elementsWithFill = svgElement.querySelectorAll('[fill]');
      elementsWithFill.forEach((element, index) => {
        const fill = element.getAttribute('fill');
        if (fill && !this.isValidColor(fill)) {
          errors.push({
            code: 'INVALID_COLOR',
            message: `无效的填充颜色: ${fill}`,
            element: `${element.tagName}[${index}]`,
            severity: 'warning',
          });
        }
      });

      // 验证数值属性
      this.validateNumericAttributes(svgElement, errors);

      // 检查重复ID
      this.validateUniqueIds(svgElement, errors);
    } catch (error) {
      errors.push({
        code: 'CONTENT_VALIDATION_ERROR',
        message: `内容验证失败: ${error.message}`,
        severity: 'error',
      });
    }
  }

  /**
   * 验证路径数据
   */
  private isValidPathData(d: string): boolean {
    // 简单的路径数据验证
    const pathCommands = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]+$/;
    return pathCommands.test(d);
  }

  /**
   * 验证颜色值
   */
  private isValidColor(color: string): boolean {
    // 支持的颜色格式
    const colorPatterns = [
      /^#[0-9A-Fa-f]{3}$/, // #RGB
      /^#[0-9A-Fa-f]{6}$/, // #RRGGBB
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/, // rgb(r,g,b)
      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/, // rgba(r,g,b,a)
      /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/, // hsl(h,s,l)
      /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/, // hsla(h,s,l,a)
    ];

    // 预定义颜色名称
    const namedColors = [
      'transparent',
      'none',
      'currentColor',
      'red',
      'green',
      'blue',
      'black',
      'white',
      'gray',
      'grey',
      'yellow',
      'orange',
      'purple',
      'pink',
      'brown',
      'cyan',
      'magenta',
    ];

    return (
      colorPatterns.some((pattern) => pattern.test(color)) ||
      namedColors.includes(color.toLowerCase())
    );
  }

  /**
   * 验证数值属性
   */
  private validateNumericAttributes(
    svgElement: Element,
    errors: ParseError[],
  ): void {
    const numericAttributes = [
      'x',
      'y',
      'width',
      'height',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'stroke-width',
    ];

    const elementsWithNumericAttrs = svgElement.querySelectorAll('*');
    elementsWithNumericAttrs.forEach((element, index) => {
      numericAttributes.forEach((attr) => {
        const value = element.getAttribute(attr);
        if (value && isNaN(Number(value))) {
          errors.push({
            code: 'INVALID_NUMERIC_VALUE',
            message: `${attr}属性值无效: ${value}`,
            element: `${element.tagName}[${index}]`,
            severity: 'warning',
          });
        }
      });
    });
  }

  /**
   * 验证ID唯一性
   */
  private validateUniqueIds(svgElement: Element, errors: ParseError[]): void {
    const elementsWithId = svgElement.querySelectorAll('[id]');
    const ids = new Set<string>();
    const duplicates = new Set<string>();

    elementsWithId.forEach((element) => {
      const id = element.getAttribute('id');
      if (id) {
        if (ids.has(id)) {
          duplicates.add(id);
        } else {
          ids.add(id);
        }
      }
    });

    duplicates.forEach((id) => {
      errors.push({
        code: 'DUPLICATE_ID',
        message: `重复的ID: ${id}`,
        severity: 'warning',
      });
    });
  }
}

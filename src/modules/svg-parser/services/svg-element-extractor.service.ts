import { Injectable, Logger } from '@nestjs/common';
import {
  SVGNode,
  SVGEdge,
  SVGConnector,
  ParsedSVGData,
  ParseOptions,
  Point,
  BoundingBox,
  Size,
} from '../types';

@Injectable()
export class SVGElementExtractorService {
  private readonly logger = new Logger(SVGElementExtractorService.name);

  /**
   * 提取SVG元素
   */
  async extractElements(
    svgElement: Element,
    options: ParseOptions,
  ): Promise<ParsedSVGData> {
    const startTime = Date.now();
    const nodes: SVGNode[] = [];
    const edges: SVGEdge[] = [];
    const connectors: SVGConnector[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 获取SVG视图框和尺寸
      const viewBox = svgElement.getAttribute('viewBox');
      const dimensions = this.extractSVGDimensions(svgElement);

      // 提取所有相关元素
      const allElements = this.getAllRelevantElements(svgElement);

      this.logger.log(`找到 ${allElements.length} 个SVG元素`);

      // 分类处理元素
      for (const element of allElements) {
        try {
          if (options.ignoreHiddenElements && this.isElementHidden(element)) {
            continue;
          }

          const elementType = this.classifyElement(element);

          switch (elementType) {
            case 'node':
              const node = this.extractNode(element, options);
              if (node) nodes.push(node);
              break;
            case 'edge':
              const edge = this.extractEdge(element, options);
              if (edge) edges.push(edge);
              break;
            case 'connector':
              const connector = this.extractConnector(element, options);
              if (connector) connectors.push(connector);
              break;
          }
        } catch (error) {
          errors.push(`处理元素失败: ${error.message}`);
          this.logger.warn(`处理元素失败: ${error.message}`);
        }
      }

      // 建立连接关系
      this.establishConnections(nodes, edges, connectors);

      const parseTime = Date.now() - startTime;

      this.logger.log(
        `元素提取完成: 节点${nodes.length}个, 边${edges.length}个, 连接器${connectors.length}个`,
      );

      return {
        nodes,
        edges,
        connectors,
        metadata: {
          totalElements: allElements.length,
          viewBox,
          dimensions,
          parseTime,
          errors,
          warnings,
        },
      };
    } catch (error) {
      this.logger.error(`元素提取失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取所有相关元素
   */
  private getAllRelevantElements(svgElement: Element): Element[] {
    const selectors = [
      'rect',
      'circle',
      'ellipse',
      'polygon',
      'path',
      'text',
      'tspan',
      'line',
      'polyline',
      'g[id]',
      '[data-node-id]',
      '[data-edge-id]',
    ];

    const elements: Element[] = [];

    for (const selector of selectors) {
      const found = svgElement.querySelectorAll(selector);
      elements.push(...Array.from(found));
    }

    // 去重
    return Array.from(new Set(elements));
  }

  /**
   * 分类元素类型
   */
  private classifyElement(
    element: Element,
  ): 'node' | 'edge' | 'connector' | 'unknown' {
    const tagName = element.tagName.toLowerCase();
    const id = element.getAttribute('id') || '';
    const className = element.getAttribute('class') || '';

    // 基于标签名分类
    if (['rect', 'circle', 'ellipse', 'polygon'].includes(tagName)) {
      return 'node';
    }

    if (['line', 'polyline'].includes(tagName)) {
      return 'connector';
    }

    if (tagName === 'path') {
      // 路径可能是节点形状或连接线
      const d = element.getAttribute('d') || '';
      if (this.isPathConnector(d)) {
        return 'connector';
      }
      return 'node';
    }

    if (tagName === 'text' || tagName === 'tspan') {
      return 'node';
    }

    // 基于属性分类
    if (id.includes('node') || className.includes('node')) {
      return 'node';
    }

    if (
      id.includes('edge') ||
      className.includes('edge') ||
      id.includes('connector') ||
      className.includes('connector')
    ) {
      return 'connector';
    }

    return 'unknown';
  }

  /**
   * 提取节点信息
   */
  private extractNode(element: Element, options: ParseOptions): SVGNode | null {
    try {
      const id = this.generateElementId(element, 'node');
      const boundingBox = this.getBoundingBox(element);
      const shape = this.getNodeShape(element);

      const node: SVGNode = {
        id,
        type: 'node',
        shape,
        boundingBox,
        attributes: this.getElementAttributes(element),
      };

      // 提取文本
      if (options.extractText) {
        node.text = this.extractTextContent(element);
      }

      // 提取样式
      if (options.extractStyles) {
        const style = this.extractElementStyle(element);
        node.fill = style.fill;
        node.stroke = style.stroke;
        node.strokeWidth = style.strokeWidth;
        node.fontSize = style.fontSize;
        node.fontFamily = style.fontFamily;
        node.style = style.raw;
      }

      // 提取变换
      if (options.extractTransforms) {
        node.transform = element.getAttribute('transform') || undefined;
      }

      return node;
    } catch (error) {
      this.logger.warn(`提取节点失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取边信息
   */
  private extractEdge(element: Element, options: ParseOptions): SVGEdge | null {
    try {
      const id = this.generateElementId(element, 'edge');
      const boundingBox = this.getBoundingBox(element);

      const edge: SVGEdge = {
        id,
        type: 'edge',
        sourceId: '',
        targetId: '',
        boundingBox,
        attributes: this.getElementAttributes(element),
      };

      // 提取路径信息
      if (element.tagName.toLowerCase() === 'path') {
        edge.path = element.getAttribute('d') || '';
      }

      // 提取样式
      if (options.extractStyles) {
        const style = this.extractElementStyle(element);
        edge.stroke = style.stroke;
        edge.strokeWidth = style.strokeWidth;
        edge.strokeDasharray = style.strokeDasharray;
        edge.markerStart = style.markerStart;
        edge.markerEnd = style.markerEnd;
        edge.style = style.raw;
      }

      return edge;
    } catch (error) {
      this.logger.warn(`提取边失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取连接器信息
   */
  private extractConnector(
    element: Element,
    options: ParseOptions,
  ): SVGConnector | null {
    try {
      const id = this.generateElementId(element, 'connector');
      const boundingBox = this.getBoundingBox(element);
      const points = this.extractPoints(element);

      return {
        id,
        type: 'connector',
        points,
        boundingBox,
        attributes: this.getElementAttributes(element),
      };
    } catch (error) {
      this.logger.warn(`提取连接器失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取SVG尺寸
   */
  private extractSVGDimensions(svgElement: Element): Size {
    const width = parseFloat(svgElement.getAttribute('width') || '0');
    const height = parseFloat(svgElement.getAttribute('height') || '0');

    if (width > 0 && height > 0) {
      return { width, height };
    }

    // 从viewBox提取
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const [, , w, h] = viewBox.split(' ').map(Number);
      return { width: w, height: h };
    }

    return { width: 0, height: 0 };
  }

  /**
   * 获取元素边界框
   */
  private getBoundingBox(element: Element): BoundingBox {
    // 这里需要根据不同元素类型计算边界框
    // 简化实现，实际应该更精确
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');

    return { x, y, width, height };
  }

  /**
   * 其他辅助方法...
   */
  private isElementHidden(element: Element): boolean {
    const style = element.getAttribute('style') || '';
    const visibility = element.getAttribute('visibility');
    const display = element.getAttribute('display');

    return (
      style.includes('display:none') ||
      style.includes('visibility:hidden') ||
      visibility === 'hidden' ||
      display === 'none'
    );
  }

  private isPathConnector(d: string): boolean {
    // 简单判断：包含移动和线条命令的路径可能是连接器
    return /[ML]/i.test(d) && d.length > 10;
  }

  private generateElementId(element: Element, prefix: string): string {
    return (
      element.getAttribute('id') ||
      `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  private getNodeShape(element: Element): SVGNode['shape'] {
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case 'rect':
        return 'rectangle';
      case 'circle':
        return 'circle';
      case 'ellipse':
        return 'ellipse';
      case 'polygon':
        return 'polygon';
      case 'path':
        return 'path';
      case 'text':
        return 'text';
      default:
        return 'rectangle';
    }
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private extractTextContent(element: Element): string {
    return element.textContent?.trim() || '';
  }

  private extractElementStyle(element: Element): any {
    // 简化的样式提取
    const style = element.getAttribute('style') || '';
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');

    return {
      fill,
      stroke,
      strokeWidth: parseFloat(element.getAttribute('stroke-width') || '1'),
      raw: style ? this.parseStyleString(style) : {},
    };
  }

  private parseStyleString(style: string): Record<string, string> {
    const result: Record<string, string> = {};
    style.split(';').forEach((rule) => {
      const [key, value] = rule.split(':').map((s) => s.trim());
      if (key && value) {
        result[key] = value;
      }
    });
    return result;
  }

  private extractPoints(element: Element): Point[] {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'line') {
      return [
        {
          x: parseFloat(element.getAttribute('x1') || '0'),
          y: parseFloat(element.getAttribute('y1') || '0'),
        },
        {
          x: parseFloat(element.getAttribute('x2') || '0'),
          y: parseFloat(element.getAttribute('y2') || '0'),
        },
      ];
    }

    if (tagName === 'polyline' || tagName === 'polygon') {
      const points = element.getAttribute('points') || '';
      return this.parsePointsString(points);
    }

    return [];
  }

  private parsePointsString(pointsStr: string): Point[] {
    return pointsStr
      .split(/[\s,]+/)
      .filter(Boolean)
      .reduce((points: Point[], coord, index, arr) => {
        if (index % 2 === 0 && index + 1 < arr.length) {
          points.push({
            x: parseFloat(coord),
            y: parseFloat(arr[index + 1]),
          });
        }
        return points;
      }, []);
  }

  private establishConnections(
    nodes: SVGNode[],
    edges: SVGEdge[],
    connectors: SVGConnector[],
  ): void {
    // 这里实现连接关系的建立逻辑
    // 基于位置、ID等信息建立节点和边的连接关系
    this.logger.log('建立连接关系...');
  }
}

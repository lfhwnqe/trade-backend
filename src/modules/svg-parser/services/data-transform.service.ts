import { Injectable, Logger } from '@nestjs/common';
import Graph from 'graphology';
import {
  GraphNode,
  GraphEdge,
  GraphData,
  ParsedSVGData,
  SVGNode,
  SVGEdge,
  SVGConnector,
} from '../types';

@Injectable()
export class DataTransformService {
  private readonly logger = new Logger(DataTransformService.name);

  /**
   * 将解析的SVG数据转换为标准图数据模型
   */
  async transformToGraphData(parsedData: ParsedSVGData): Promise<GraphData> {
    try {
      this.logger.log('开始转换SVG数据为图数据模型');

      // 创建图实例
      const graph = new Graph();

      // 转换节点
      const graphNodes = await this.transformNodes(parsedData.nodes);

      // 转换边
      const graphEdges = await this.transformEdges(
        parsedData.edges,
        parsedData.connectors,
        graphNodes,
      );

      // 添加节点到图
      graphNodes.forEach((node) => {
        graph.addNode(node.id, node);
      });

      // 添加边到图
      graphEdges.forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, edge);
        }
      });

      // 数据清洗和验证
      const cleanedData = await this.cleanAndValidateData(
        graphNodes,
        graphEdges,
      );

      const graphData: GraphData = {
        nodes: cleanedData.nodes,
        edges: cleanedData.edges,
        metadata: {
          nodeCount: cleanedData.nodes.length,
          edgeCount: cleanedData.edges.length,
          sourceFormat: 'SVG',
          createdAt: new Date(),
          version: '1.0',
        },
      };

      this.logger.log(
        `数据转换完成: ${graphData.nodes.length}个节点, ${graphData.edges.length}条边`,
      );
      return graphData;
    } catch (error) {
      this.logger.error(`数据转换失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 转换SVG节点为图节点
   */
  private async transformNodes(svgNodes: SVGNode[]): Promise<GraphNode[]> {
    const graphNodes: GraphNode[] = [];

    for (const svgNode of svgNodes) {
      try {
        const graphNode: GraphNode = {
          id: svgNode.id,
          label: this.extractNodeLabel(svgNode),
          type: this.determineNodeType(svgNode),
          properties: this.extractNodeProperties(svgNode),
          position: {
            x: svgNode.boundingBox.x,
            y: svgNode.boundingBox.y,
          },
          size: {
            width: svgNode.boundingBox.width,
            height: svgNode.boundingBox.height,
          },
          style: {
            fill: svgNode.fill,
            stroke: svgNode.stroke,
            strokeWidth: svgNode.strokeWidth,
            fontSize: svgNode.fontSize,
            fontFamily: svgNode.fontFamily,
          },
        };

        graphNodes.push(graphNode);
      } catch (error) {
        this.logger.warn(`转换节点失败 ${svgNode.id}: ${error.message}`);
      }
    }

    return graphNodes;
  }

  /**
   * 转换SVG边和连接器为图边
   */
  private async transformEdges(
    svgEdges: SVGEdge[],
    connectors: SVGConnector[],
    graphNodes: GraphNode[],
  ): Promise<GraphEdge[]> {
    const graphEdges: GraphEdge[] = [];

    // 转换显式边
    for (const svgEdge of svgEdges) {
      try {
        if (svgEdge.sourceId && svgEdge.targetId) {
          const graphEdge: GraphEdge = {
            id: svgEdge.id,
            source: svgEdge.sourceId,
            target: svgEdge.targetId,
            label: svgEdge.label,
            type: 'explicit',
            properties: this.extractEdgeProperties(svgEdge),
            style: {
              stroke: svgEdge.stroke,
              strokeWidth: svgEdge.strokeWidth,
              strokeDasharray: svgEdge.strokeDasharray,
            },
          };

          graphEdges.push(graphEdge);
        }
      } catch (error) {
        this.logger.warn(`转换边失败 ${svgEdge.id}: ${error.message}`);
      }
    }

    // 从连接器推断边
    const inferredEdges = await this.inferEdgesFromConnectors(
      connectors,
      graphNodes,
    );
    graphEdges.push(...inferredEdges);

    return graphEdges;
  }

  /**
   * 从连接器推断边关系
   */
  private async inferEdgesFromConnectors(
    connectors: SVGConnector[],
    graphNodes: GraphNode[],
  ): Promise<GraphEdge[]> {
    const inferredEdges: GraphEdge[] = [];

    for (const connector of connectors) {
      try {
        // 找到连接器的起点和终点最近的节点
        const sourceNode = this.findNearestNode(
          connector.points[0],
          graphNodes,
        );
        const targetNode = this.findNearestNode(
          connector.points[connector.points.length - 1],
          graphNodes,
        );

        if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
          const edgeId = `${connector.id}_edge`;
          const graphEdge: GraphEdge = {
            id: edgeId,
            source: sourceNode.id,
            target: targetNode.id,
            type: 'inferred',
            properties: {
              connectorId: connector.id,
              points: connector.points,
              ...this.extractConnectorProperties(connector),
            },
            style: {
              stroke: '#000000',
              strokeWidth: 1,
            },
          };

          inferredEdges.push(graphEdge);
        }
      } catch (error) {
        this.logger.warn(
          `从连接器推断边失败 ${connector.id}: ${error.message}`,
        );
      }
    }

    return inferredEdges;
  }

  /**
   * 找到最近的节点
   */
  private findNearestNode(
    point: { x: number; y: number },
    nodes: GraphNode[],
  ): GraphNode | null {
    let nearestNode: GraphNode | null = null;
    let minDistance = Infinity;

    for (const node of nodes) {
      const distance = this.calculateDistance(point, {
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2,
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    }

    // 只有距离在合理范围内才认为是连接
    return minDistance < 50 ? nearestNode : null;
  }

  /**
   * 计算两点间距离
   */
  private calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number },
  ): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 提取节点标签
   */
  private extractNodeLabel(svgNode: SVGNode): string {
    if (svgNode.text && svgNode.text.trim()) {
      return svgNode.text.trim();
    }

    // 从属性中提取标签
    const title =
      svgNode.attributes['title'] || svgNode.attributes['data-title'];
    if (title) {
      return title;
    }

    // 使用ID作为标签
    return svgNode.id;
  }

  /**
   * 确定节点类型
   */
  private determineNodeType(svgNode: SVGNode): string {
    // 基于形状确定类型
    switch (svgNode.shape) {
      case 'circle':
      case 'ellipse':
        return 'concept';
      case 'rectangle':
        return 'process';
      case 'polygon':
        return 'decision';
      case 'text':
        return 'label';
      default:
        return 'default';
    }
  }

  /**
   * 提取节点属性
   */
  private extractNodeProperties(svgNode: SVGNode): Record<string, any> {
    return {
      shape: svgNode.shape,
      originalId: svgNode.id,
      attributes: svgNode.attributes,
      transform: svgNode.transform,
      hasText: !!svgNode.text,
      textLength: svgNode.text?.length || 0,
    };
  }

  /**
   * 提取边属性
   */
  private extractEdgeProperties(svgEdge: SVGEdge): Record<string, any> {
    return {
      originalId: svgEdge.id,
      attributes: svgEdge.attributes,
      path: svgEdge.path,
      markerStart: svgEdge.markerStart,
      markerEnd: svgEdge.markerEnd,
      hasLabel: !!svgEdge.label,
    };
  }

  /**
   * 提取连接器属性
   */
  private extractConnectorProperties(
    connector: SVGConnector,
  ): Record<string, any> {
    return {
      originalId: connector.id,
      attributes: connector.attributes,
      pointCount: connector.points.length,
      length: this.calculateConnectorLength(connector.points),
    };
  }

  /**
   * 计算连接器长度
   */
  private calculateConnectorLength(points: { x: number; y: number }[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += this.calculateDistance(points[i - 1], points[i]);
    }
    return length;
  }

  /**
   * 数据清洗和验证
   */
  private async cleanAndValidateData(
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    // 去重节点
    const uniqueNodes = this.deduplicateNodes(nodes);

    // 去重边
    const uniqueEdges = this.deduplicateEdges(edges);

    // 验证边的节点存在性
    const validEdges = uniqueEdges.filter((edge) => {
      const sourceExists = uniqueNodes.some((node) => node.id === edge.source);
      const targetExists = uniqueNodes.some((node) => node.id === edge.target);

      if (!sourceExists || !targetExists) {
        this.logger.warn(`边 ${edge.id} 的源节点或目标节点不存在`);
        return false;
      }

      return true;
    });

    // 清理空标签
    uniqueNodes.forEach((node) => {
      if (!node.label || node.label.trim() === '') {
        node.label = node.id;
      }
    });

    this.logger.log(
      `数据清洗完成: ${uniqueNodes.length}个节点, ${validEdges.length}条边`,
    );

    return {
      nodes: uniqueNodes,
      edges: validEdges,
    };
  }

  /**
   * 去重节点
   */
  private deduplicateNodes(nodes: GraphNode[]): GraphNode[] {
    const seen = new Set<string>();
    return nodes.filter((node) => {
      if (seen.has(node.id)) {
        this.logger.warn(`发现重复节点: ${node.id}`);
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }

  /**
   * 去重边
   */
  private deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
    const seen = new Set<string>();
    return edges.filter((edge) => {
      const key = `${edge.source}-${edge.target}`;
      if (seen.has(key)) {
        this.logger.warn(`发现重复边: ${key}`);
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

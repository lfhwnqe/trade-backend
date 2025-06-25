import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { DirectedGraph } from 'data-structure-typed';
import { MindMapData, MindMapNode, ForceGraphData } from '../types/mindmap.types';

@Injectable()
export class MindMapParserService {
  private readonly logger = new Logger(MindMapParserService.name);
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    });
  }

  /**
   * 解析多种格式的思维导图文件
   */
  async parseMindMap(content: string, format: string): Promise<MindMapData> {
    this.logger.log(`开始解析思维导图，格式: ${format}`);

    try {
      switch (format.toLowerCase()) {
        case 'freemind':
        case 'mm':
          return this.parseFreeMind(content);
        case 'xmind':
          return this.parseXMind(content);
        case 'opml':
          return this.parseOPML(content);
        case 'json':
          return this.parseJSON(content);
        case 'markdown':
        case 'md':
          return this.parseMarkdown(content);
        default:
          throw new Error(`不支持的思维导图格式: ${format}`);
      }
    } catch (error) {
      this.logger.error(`解析思维导图失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 解析FreeMind格式 (.mm文件)
   */
  private parseFreeMind(xmlContent: string): MindMapData {
    const parsed = this.xmlParser.parse(xmlContent);
    const map = parsed.map;

    if (!map || !map.node) {
      throw new Error('无效的FreeMind文件格式');
    }

    const nodes: MindMapNode[] = [];
    const links: Array<{ source: string; target: string }> = [];
    let nodeIdCounter = 0;

    const processNode = (node: any, parentId?: string, level = 0): string => {
      const nodeId = `node_${nodeIdCounter++}`;
      const text = node['@_TEXT'] || node['@_text'] || '未命名节点';

      const mindMapNode: MindMapNode = {
        id: nodeId,
        text,
        level,
        parentId,
        position: node['@_POSITION']
          ? {
              x: parseFloat(node['@_POSITION'].split(',')[0] || '0'),
              y: parseFloat(node['@_POSITION'].split(',')[1] || '0'),
            }
          : undefined,
        style: {
          color: node['@_COLOR'],
          backgroundColor: node['@_BACKGROUND_COLOR'],
        },
      };

      nodes.push(mindMapNode);

      if (parentId) {
        links.push({
          source: parentId,
          target: nodeId,
        });
      }

      // 处理子节点
      if (node.node) {
        const children = Array.isArray(node.node) ? node.node : [node.node];
        children.forEach((child) => {
          processNode(child, nodeId, level + 1);
        });
      }

      return nodeId;
    };

    processNode(map.node);

    return {
      nodes,
      links,
      metadata: {
        format: 'freemind',
        title: map.node['@_TEXT'] || '思维导图',
      },
    };
  }

  /**
   * 解析OPML格式
   */
  private parseOPML(xmlContent: string): MindMapData {
    const parsed = this.xmlParser.parse(xmlContent);
    const opml = parsed.opml;

    if (!opml || !opml.body) {
      throw new Error('无效的OPML文件格式');
    }

    const nodes: MindMapNode[] = [];
    const links: Array<{ source: string; target: string }> = [];
    let nodeIdCounter = 0;

    const processOutline = (
      outline: any,
      parentId?: string,
      level = 0,
    ): string => {
      const nodeId = `node_${nodeIdCounter++}`;
      const text = outline['@_text'] || outline['@_title'] || '未命名节点';

      const mindMapNode: MindMapNode = {
        id: nodeId,
        text,
        level,
        parentId,
      };

      nodes.push(mindMapNode);

      if (parentId) {
        links.push({
          source: parentId,
          target: nodeId,
        });
      }

      // 处理子节点
      if (outline.outline) {
        const children = Array.isArray(outline.outline)
          ? outline.outline
          : [outline.outline];
        children.forEach((child) => {
          processOutline(child, nodeId, level + 1);
        });
      }

      return nodeId;
    };

    const body = opml.body;
    if (body.outline) {
      const outlines = Array.isArray(body.outline)
        ? body.outline
        : [body.outline];
      outlines.forEach((outline) => {
        processOutline(outline);
      });
    }

    return {
      nodes,
      links,
      metadata: {
        format: 'opml',
        title: opml.head?.title || '思维导图',
        author: opml.head?.ownerName,
        created: opml.head?.dateCreated,
        modified: opml.head?.dateModified,
      },
    };
  }

  /**
   * 解析JSON格式
   */
  private parseJSON(jsonContent: string): MindMapData {
    const data = JSON.parse(jsonContent);

    // 如果已经是标准格式，直接返回
    if (data.nodes && data.links) {
      return data;
    }

    // 如果是simple-mind-map格式
    if (data.data && data.children !== undefined) {
      return this.parseSimpleMindMapFormat(data);
    }

    throw new Error('不支持的JSON格式');
  }

  /**
   * 解析simple-mind-map格式
   */
  private parseSimpleMindMapFormat(data: any): MindMapData {
    const nodes: MindMapNode[] = [];
    const links: Array<{ source: string; target: string }> = [];
    let nodeIdCounter = 0;

    const processNode = (node: any, parentId?: string, level = 0): string => {
      const nodeId = `node_${nodeIdCounter++}`;
      const text = node.data?.text || '未命名节点';

      const mindMapNode: MindMapNode = {
        id: nodeId,
        text,
        level,
        parentId,
      };

      nodes.push(mindMapNode);

      if (parentId) {
        links.push({
          source: parentId,
          target: nodeId,
        });
      }

      // 处理子节点
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          processNode(child, nodeId, level + 1);
        });
      }

      return nodeId;
    };

    processNode(data);

    return {
      nodes,
      links,
      metadata: {
        format: 'simple-mind-map',
        title: data.data?.text || '思维导图',
      },
    };
  }

  /**
   * 解析Markdown格式的思维导图
   */
  private parseMarkdown(content: string): MindMapData {
    const lines = content.split('\n').filter((line) => line.trim());
    const nodes: MindMapNode[] = [];
    const links: Array<{ source: string; target: string }> = [];
    const nodeStack: Array<{ id: string; level: number }> = [];
    let nodeIdCounter = 0;

    for (const line of lines) {
      const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (!match) continue;

      const indent = match[1].length;
      const text = match[3].trim();
      const level = Math.floor(indent / 2); // 假设每级缩进2个空格
      const nodeId = `node_${nodeIdCounter++}`;

      // 清理栈，保留当前级别的父节点
      while (
        nodeStack.length > 0 &&
        nodeStack[nodeStack.length - 1].level >= level
      ) {
        nodeStack.pop();
      }

      const parentId =
        nodeStack.length > 0 ? nodeStack[nodeStack.length - 1].id : undefined;

      const mindMapNode: MindMapNode = {
        id: nodeId,
        text,
        level,
        parentId,
      };

      nodes.push(mindMapNode);

      if (parentId) {
        links.push({
          source: parentId,
          target: nodeId,
        });
      }

      nodeStack.push({ id: nodeId, level });
    }

    return {
      nodes,
      links,
      metadata: {
        format: 'markdown',
        title: '思维导图',
      },
    };
  }

  /**
   * 解析XMind格式 (简化版本，实际XMind格式更复杂)
   */
  private parseXMind(content: string): MindMapData {
    // XMind实际上是一个ZIP文件，包含XML文件
    // 这里提供一个简化的XML解析示例
    throw new Error('XMind格式解析需要额外的ZIP解压缩支持，请使用其他格式');
  }

  /**
   * 转换为图数据格式 (适用于force-graph等可视化库)
   */
  convertToGraphData(mindMapData: MindMapData): ForceGraphData {
    const nodes = mindMapData.nodes.map((node) => ({
      id: node.id,
      name: node.text,
      val: Math.max(1, 10 - node.level), // 根据层级设置节点大小
      group: node.level.toString(),
      level: node.level,
      ...node.style,
    }));

    const links = mindMapData.links.map((link) => ({
      source: link.source,
      target: link.target,
      value: 1,
      type: link.type || 'hierarchy',
    }));

    return { nodes, links };
  }

  /**
   * 转换为有向图数据结构
   */
  convertToDirectedGraph(mindMapData: MindMapData): DirectedGraph<string> {
    const graph = new DirectedGraph<string>();

    // 添加节点
    mindMapData.nodes.forEach((node) => {
      graph.addVertex(node.id, node.text);
    });

    // 添加边
    mindMapData.links.forEach((link) => {
      graph.addEdge(link.source, link.target);
    });

    return graph;
  }
}

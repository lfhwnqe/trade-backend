/**
 * SVG解析引擎类型定义
 */

// 基础几何类型
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// SVG元素类型
export interface SVGElementBase {
  id: string;
  type: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  transform?: string;
  style?: Record<string, string>;
}

// 节点类型
export interface SVGNode extends SVGElementBase {
  type: 'node';
  text?: string;
  shape: 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'path' | 'text';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: string;
  children?: SVGNode[];
}

// 边类型
export interface SVGEdge extends SVGElementBase {
  type: 'edge';
  sourceId: string;
  targetId: string;
  label?: string;
  path?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

// 连接器类型
export interface SVGConnector extends SVGElementBase {
  type: 'connector';
  points: Point[];
  sourceNode?: string;
  targetNode?: string;
}

// 解析结果
export interface ParsedSVGData {
  nodes: SVGNode[];
  edges: SVGEdge[];
  connectors: SVGConnector[];
  metadata: {
    totalElements: number;
    viewBox?: string;
    dimensions: Size;
    parseTime: number;
    errors: string[];
    warnings: string[];
  };
}

// 图数据模型
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  position: Point;
  size: Size;
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    fontFamily?: string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: string;
  properties: Record<string, any>;
  style: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    sourceFormat: string;
    createdAt: Date;
    version: string;
  };
}

// 解析选项
export interface ParseOptions {
  extractText: boolean;
  extractStyles: boolean;
  extractTransforms: boolean;
  ignoreHiddenElements: boolean;
  maxNodes: number;
  timeout: number; // 毫秒
  validateStructure: boolean;
}

// 错误类型
export interface ParseError {
  code: string;
  message: string;
  element?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

// 性能指标
export interface PerformanceMetrics {
  parseTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  elementCount: number;
}

// 输入类型
export type SVGInput = string | Buffer | File;

export interface SVGParseRequest {
  input: SVGInput;
  inputType: 'url' | 'file' | 'string';
  options?: Partial<ParseOptions>;
}

export interface SVGParseResponse {
  success: boolean;
  data?: GraphData;
  errors: ParseError[];
  metrics: PerformanceMetrics;
}

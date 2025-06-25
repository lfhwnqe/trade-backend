export interface MindMapNode {
  id: string;
  text: string;
  level: number;
  parentId?: string;
  children?: MindMapNode[];
  position?: { x: number; y: number };
  style?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontWeight?: string;
  };
}

export interface MindMapData {
  nodes: MindMapNode[];
  links: Array<{
    source: string;
    target: string;
    type?: string;
  }>;
  metadata?: {
    title?: string;
    author?: string;

    created?: string;
    modified?: string;
    format?: string;
  };
}

export interface ForceGraphData {
  nodes: Array<{
    id: string;
    name: string;
    val?: number;
    group?: string;
    level?: number;
    [key: string]: any;
  }>;
  links: Array<{
    source: string;
    target: string;
    value?: number;
    type?: string;
    [key: string]: any;
  }>;
}

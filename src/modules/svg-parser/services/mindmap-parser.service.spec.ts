import { Test, TestingModule } from '@nestjs/testing';
import { MindMapParserService } from './mindmap-parser.service';
import * as fs from 'fs';
import * as path from 'path';

describe('MindMapParserService', () => {
  let service: MindMapParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MindMapParserService],
    }).compile();

    service = module.get<MindMapParserService>(MindMapParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseFreeMind', () => {
    it('should parse FreeMind format correctly', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.mm',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const result = await service.parseMindMap(content, 'freemind');

      expect(result.nodes).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.metadata?.format).toBe('freemind');

      // 检查根节点
      const rootNode = result.nodes.find((node) => node.level === 0);
      expect(rootNode).toBeDefined();
      expect(rootNode?.text).toBe('中心主题');
    });
  });

  describe('parseOPML', () => {
    it('should parse OPML format correctly', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.opml',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const result = await service.parseMindMap(content, 'opml');

      expect(result.nodes).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.metadata?.format).toBe('opml');
      expect(result.metadata?.title).toBe('示例思维导图');
    });
  });

  describe('parseJSON', () => {
    it('should parse simple-mind-map JSON format correctly', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.json',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const result = await service.parseMindMap(content, 'json');

      expect(result.nodes).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.metadata?.format).toBe('simple-mind-map');
    });
  });

  describe('parseMarkdown', () => {
    it('should parse Markdown format correctly', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.md',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const result = await service.parseMindMap(content, 'markdown');

      expect(result.nodes).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.metadata?.format).toBe('markdown');
    });
  });

  describe('convertToGraphData', () => {
    it('should convert mind map data to graph format', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.json',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const mindMapData = await service.parseMindMap(content, 'json');
      const graphData = service.convertToGraphData(mindMapData);

      expect(graphData.nodes).toBeDefined();
      expect(graphData.links).toBeDefined();
      expect(graphData.nodes.length).toBe(mindMapData.nodes.length);
      expect(graphData.links.length).toBe(mindMapData.links.length);

      // 检查节点格式
      const firstNode = graphData.nodes[0];
      expect(firstNode).toHaveProperty('id');
      expect(firstNode).toHaveProperty('name');
      expect(firstNode).toHaveProperty('val');
      expect(firstNode).toHaveProperty('group');
      expect(firstNode).toHaveProperty('level');

      // 检查链接格式
      if (graphData.links.length > 0) {
        const firstLink = graphData.links[0];
        expect(firstLink).toHaveProperty('source');
        expect(firstLink).toHaveProperty('target');
        expect(firstLink).toHaveProperty('value');
        expect(firstLink).toHaveProperty('type');
      }
    });
  });

  describe('convertToDirectedGraph', () => {
    it('should convert mind map data to directed graph', async () => {
      const testDataPath = path.join(
        __dirname,
        '../test-data/sample-mindmap.json',
      );
      const content = fs.readFileSync(testDataPath, 'utf-8');

      const mindMapData = await service.parseMindMap(content, 'json');
      const directedGraph = service.convertToDirectedGraph(mindMapData);

      expect(directedGraph).toBeDefined();

      // 检查图中的节点数量
      expect(directedGraph).toBeDefined();
      // 检查是否能正确添加节点
      expect(directedGraph.hasVertex(mindMapData.nodes[0].id)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(
        service.parseMindMap('test content', 'unsupported'),
      ).rejects.toThrow('不支持的思维导图格式: unsupported');
    });

    it('should throw error for invalid FreeMind XML', async () => {
      const invalidXml = '<invalid>xml</invalid>';
      await expect(
        service.parseMindMap(invalidXml, 'freemind'),
      ).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      await expect(service.parseMindMap(invalidJson, 'json')).rejects.toThrow();
    });
  });
});

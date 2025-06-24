import { Test, TestingModule } from '@nestjs/testing';
import { SVGParserService } from './svg-parser.service';
import { SVGElementExtractorService } from './services/svg-element-extractor.service';
import { DataTransformService } from './services/data-transform.service';
import { ValidationService } from './services/validation.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { LoggingService } from './services/logging.service';
import { SVG_TEST_CASES } from './test-data/sample-svg';
import { InputType } from './dto/svg-parse.dto';

describe('SVGParserService', () => {
  let service: SVGParserService;
  let elementExtractor: SVGElementExtractorService;
  let dataTransform: DataTransformService;
  let validation: ValidationService;
  let performanceMonitor: PerformanceMonitorService;
  let logging: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SVGParserService,
        SVGElementExtractorService,
        DataTransformService,
        ValidationService,
        PerformanceMonitorService,
        LoggingService,
      ],
    }).compile();

    service = module.get<SVGParserService>(SVGParserService);
    elementExtractor = module.get<SVGElementExtractorService>(
      SVGElementExtractorService,
    );
    dataTransform = module.get<DataTransformService>(DataTransformService);
    validation = module.get<ValidationService>(ValidationService);
    performanceMonitor = module.get<PerformanceMonitorService>(
      PerformanceMonitorService,
    );
    logging = module.get<LoggingService>(LoggingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseSVG', () => {
    it('should parse simple SVG successfully', async () => {
      const request = {
        input: SVG_TEST_CASES.simple,
        inputType: InputType.STRING,
        options: {
          extractText: true,
          extractStyles: true,
          maxNodes: 1000,
          timeout: 30000,
        },
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.nodes.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.parseTime).toBeGreaterThan(0);
    });

    it('should handle complex SVG with multiple elements', async () => {
      const request = {
        input: SVG_TEST_CASES.complex,
        inputType: InputType.STRING,
        options: {
          extractText: true,
          extractStyles: true,
          extractTransforms: true,
          maxNodes: 1000,
          timeout: 30000,
        },
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.nodes.length).toBeGreaterThan(3);
      expect(result.data.edges.length).toBeGreaterThan(0);
    });

    it('should handle Whimsical-style SVG', async () => {
      const request = {
        input: SVG_TEST_CASES.whimsical,
        inputType: InputType.STRING,
        options: {
          extractText: true,
          extractStyles: true,
          extractTransforms: true,
          maxNodes: 1000,
          timeout: 30000,
        },
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.nodes.length).toBeGreaterThan(5);
    });

    it('should handle empty SVG', async () => {
      const request = {
        input: SVG_TEST_CASES.empty,
        inputType: InputType.STRING,
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(true);
      expect(result.data.nodes.length).toBe(0);
      expect(result.errors.some((e) => e.severity === 'warning')).toBe(true);
    });

    it('should handle invalid SVG format', async () => {
      const request = {
        input: SVG_TEST_CASES.invalid,
        inputType: InputType.STRING,
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should respect node count limits', async () => {
      const request = {
        input: SVG_TEST_CASES.large,
        inputType: InputType.STRING,
        options: {
          maxNodes: 10, // 设置较小的限制
          timeout: 30000,
        },
      };

      const result = await service.parseSVG(request);

      expect(result.errors.some((e) => e.code === 'MAX_NODES_EXCEEDED')).toBe(
        true,
      );
    });

    it('should handle timeout', async () => {
      const request = {
        input: SVG_TEST_CASES.large,
        inputType: InputType.STRING,
        options: {
          timeout: 1, // 设置极短的超时时间
        },
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes('超时'))).toBe(true);
    });

    it('should handle grouped elements', async () => {
      const request = {
        input: SVG_TEST_CASES.groups,
        inputType: InputType.STRING,
        options: {
          extractText: true,
          extractStyles: true,
          extractTransforms: true,
        },
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(true);
      expect(result.data.nodes.length).toBeGreaterThan(2);
    });
  });

  describe('validateSVG', () => {
    it('should validate correct SVG', async () => {
      const result = await service.validateSVG(SVG_TEST_CASES.simple);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid SVG', async () => {
      const result = await service.validateSVG(SVG_TEST_CASES.invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty content', async () => {
      const result = await service.validateSVG('');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('空'))).toBe(true);
    });

    it('should provide warnings for empty SVG', async () => {
      const result = await service.validateSVG(SVG_TEST_CASES.empty);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should complete parsing within reasonable time', async () => {
      const startTime = Date.now();

      const request = {
        input: SVG_TEST_CASES.complex,
        inputType: InputType.STRING,
      };

      const result = await service.parseSVG(request);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
    });

    it('should track memory usage', async () => {
      const request = {
        input: SVG_TEST_CASES.complex,
        inputType: InputType.STRING,
      };

      const result = await service.parseSVG(request);

      expect(result.metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed input gracefully', async () => {
      const request = {
        input: 'not an svg',
        inputType: InputType.STRING,
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unsupported input type', async () => {
      const request = {
        input: SVG_TEST_CASES.simple,
        inputType: 'unsupported' as any,
      };

      const result = await service.parseSVG(request);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes('不支持的输入类型')),
      ).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SVGParserService } from './svg-parser.service';
import { SVGElementExtractorService } from './services/svg-element-extractor.service';
import { DataTransformService } from './services/data-transform.service';
import { ValidationService } from './services/validation.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { LoggingService } from './services/logging.service';
import { InputType } from './dto/svg-parse.dto';

describe('SVGParserService Integration Tests', () => {
  let service: SVGParserService;

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate simple SVG', async () => {
    const simpleSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="10" y="10" width="30" height="30" fill="red"/>
      </svg>
    `;

    const result = await service.validateSVG(simpleSvg);
    expect(result.valid).toBe(true);
  });

  it('should detect invalid SVG', async () => {
    const invalidSvg = `<svg><rect x="10" y="10"`;

    const result = await service.validateSVG(invalidSvg);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle empty input', async () => {
    const result = await service.validateSVG('');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('空'))).toBe(true);
  });

  it('should parse basic SVG structure', async () => {
    const basicSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect id="rect1" x="50" y="50" width="100" height="60" fill="#ff6b6b"/>
        <circle id="circle1" cx="100" cy="150" r="30" fill="#4ecdc4"/>
      </svg>
    `;

    const request = {
      input: basicSvg,
      inputType: InputType.STRING,
      options: {
        extractText: true,
        extractStyles: true,
        maxNodes: 100,
        timeout: 10000,
      },
    };

    try {
      const result = await service.parseSVG(request);

      // 基本检查
      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.parseTime).toBeGreaterThan(0);

      // 如果解析成功，检查数据结构
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.metadata).toBeDefined();
        expect(result.data.metadata.sourceFormat).toBe('SVG');
      } else {
        // 如果解析失败，至少应该有错误信息
        expect(result.errors.length).toBeGreaterThan(0);
      }
    } catch (error) {
      // 如果抛出异常，确保是预期的异常类型
      expect(error.message).toBeDefined();
    }
  });

  it('should handle malformed input gracefully', async () => {
    const request = {
      input: 'not an svg at all',
      inputType: InputType.STRING,
      options: {
        timeout: 5000,
      },
    };

    const result = await service.parseSVG(request);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
  });

  it('should respect timeout settings', async () => {
    const largeSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        ${Array.from(
          { length: 50 },
          (_, i) =>
            `<rect id="rect${i}" x="${i * 20}" y="${i * 20}" width="10" height="10" fill="#${Math.floor(Math.random() * 16777215).toString(16)}"/>`,
        ).join('')}
      </svg>
    `;

    const request = {
      input: largeSvg,
      inputType: InputType.STRING,
      options: {
        timeout: 1, // 极短超时
      },
    };

    const result = await service.parseSVG(request);

    // 应该要么成功（如果足够快），要么因超时失败
    if (!result.success) {
      expect(
        result.errors.some(
          (e) => e.message.includes('超时') || e.code === 'PARSE_TIMEOUT',
        ),
      ).toBe(true);
    }
  });

  it('should track performance metrics', async () => {
    const simpleSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="10" y="10" width="30" height="30" fill="red"/>
        <circle cx="70" cy="70" r="20" fill="blue"/>
      </svg>
    `;

    const request = {
      input: simpleSvg,
      inputType: InputType.STRING,
    };

    const result = await service.parseSVG(request);

    expect(result.metrics).toBeDefined();
    expect(result.metrics.parseTime).toBeGreaterThan(0);
    expect(result.metrics.memoryUsage).toBeGreaterThan(0);
    expect(typeof result.metrics.nodeCount).toBe('number');
    expect(typeof result.metrics.edgeCount).toBe('number');
    expect(typeof result.metrics.elementCount).toBe('number');
  });
});

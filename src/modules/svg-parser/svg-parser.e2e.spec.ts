import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SVGParserModule } from './svg-parser.module';
import { SVG_TEST_CASES } from './test-data/sample-svg';

describe('SVGParserController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SVGParserModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/svg-parser/validate (POST)', () => {
    it('should validate correct SVG', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/validate')
        .send({ svgContent: SVG_TEST_CASES.simple })
        .expect(201)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
          expect(res.body.errors).toEqual([]);
        });
    });

    it('should detect invalid SVG', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/validate')
        .send({ svgContent: SVG_TEST_CASES.invalid })
        .expect(201)
        .expect((res) => {
          expect(res.body.valid).toBe(false);
          expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });

    it('should handle empty content', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/validate')
        .send({ svgContent: '' })
        .expect(201)
        .expect((res) => {
          expect(res.body.valid).toBe(false);
          expect(res.body.errors.some((e: string) => e.includes('空'))).toBe(
            true,
          );
        });
    });
  });

  describe('/svg-parser/parse-string (POST)', () => {
    it('should parse simple SVG successfully', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.simple,
          options: {
            extractText: true,
            extractStyles: true,
            maxNodes: 1000,
            timeout: 30000,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
          expect(res.body.data.nodes).toBeDefined();
          expect(res.body.data.edges).toBeDefined();
          expect(res.body.metrics).toBeDefined();
          expect(res.body.metrics.parseTime).toBeGreaterThan(0);
        });
    });

    it('should handle complex SVG', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.complex,
          options: {
            extractText: true,
            extractStyles: true,
            extractTransforms: true,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.nodes.length).toBeGreaterThan(0);
          expect(res.body.data.metadata).toBeDefined();
          expect(res.body.data.metadata.sourceFormat).toBe('SVG');
        });
    });

    it('should handle Whimsical-style SVG', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.whimsical,
          options: {
            extractText: true,
            extractStyles: true,
            extractTransforms: true,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.nodes.length).toBeGreaterThan(3);
          expect(res.body.data.metadata.nodeCount).toBeGreaterThan(0);
        });
    });

    it('should handle grouped elements', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.groups,
          options: {
            extractText: true,
            extractStyles: true,
            extractTransforms: true,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.nodes.length).toBeGreaterThan(0);
        });
    });

    it('should handle empty SVG with warnings', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.empty,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.nodes.length).toBe(0);
          expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });

    it('should fail on invalid SVG', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.invalid,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });

    it('should respect node count limits', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.large,
          options: {
            maxNodes: 10, // 设置较小的限制
          },
        })
        .expect(201)
        .expect((res) => {
          // 可能成功但有警告，或者失败
          if (res.body.success) {
            expect(
              res.body.errors.some((e: any) => e.code === 'MAX_NODES_EXCEEDED'),
            ).toBe(true);
          } else {
            expect(res.body.errors.length).toBeGreaterThan(0);
          }
        });
    });

    it('should handle timeout gracefully', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.large,
          options: {
            timeout: 1, // 极短超时
          },
        })
        .expect(201)
        .expect((res) => {
          // 可能成功（如果足够快）或失败（超时）
          if (!res.body.success) {
            expect(
              res.body.errors.some(
                (e: any) =>
                  e.message.includes('超时') || e.code === 'PARSE_TIMEOUT',
              ),
            ).toBe(true);
          }
        });
    });

    it('should validate request body', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          // 缺少 svgContent
          options: {
            extractText: true,
          },
        })
        .expect(400);
    });

    it('should handle malformed input', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: 'not an svg at all',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });
  });

  describe('/svg-parser/parse (POST)', () => {
    it('should parse with generic endpoint', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse')
        .send({
          input: SVG_TEST_CASES.simple,
          inputType: 'string',
          options: {
            extractText: true,
            extractStyles: true,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
          expect(res.body.metrics).toBeDefined();
        });
    });

    it('should validate input type', () => {
      return request(app.getHttpServer())
        .post('/svg-parser/parse')
        .send({
          input: SVG_TEST_CASES.simple,
          inputType: 'invalid_type',
        })
        .expect(400);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/svg-parser/parse-string')
          .send({
            svgContent: SVG_TEST_CASES.simple,
            options: { timeout: 10000 },
          }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body.metrics).toBeDefined();
      });
    });

    it('should complete parsing within reasonable time', () => {
      const startTime = Date.now();

      return request(app.getHttpServer())
        .post('/svg-parser/parse-string')
        .send({
          svgContent: SVG_TEST_CASES.complex,
        })
        .expect(201)
        .expect((res) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          expect(duration).toBeLessThan(10000); // 10秒内完成
          expect(res.body.metrics.parseTime).toBeGreaterThan(0);
        });
    });
  });
});

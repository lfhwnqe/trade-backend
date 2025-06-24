import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * SVG解析异常基类
 */
export class SVGParserException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code?: string,
    public readonly details?: any,
  ) {
    super(
      {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}

/**
 * SVG格式无效异常
 */
export class InvalidSVGFormatException extends SVGParserException {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_SVG_FORMAT', details);
  }
}

/**
 * SVG解析超时异常
 */
export class SVGParseTimeoutException extends SVGParserException {
  constructor(timeout: number) {
    super(
      `SVG解析超时，超过${timeout}ms`,
      HttpStatus.REQUEST_TIMEOUT,
      'PARSE_TIMEOUT',
      { timeout },
    );
  }
}

/**
 * SVG文件过大异常
 */
export class SVGFileTooLargeException extends SVGParserException {
  constructor(size: number, maxSize: number) {
    super(
      `SVG文件过大，当前${size}字节，最大允许${maxSize}字节`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      'FILE_TOO_LARGE',
      { size, maxSize },
    );
  }
}

/**
 * 节点数量超限异常
 */
export class TooManyNodesException extends SVGParserException {
  constructor(nodeCount: number, maxNodes: number) {
    super(
      `节点数量超过限制，当前${nodeCount}个，最大允许${maxNodes}个`,
      HttpStatus.BAD_REQUEST,
      'TOO_MANY_NODES',
      { nodeCount, maxNodes },
    );
  }
}

/**
 * 内存使用超限异常
 */
export class MemoryLimitExceededException extends SVGParserException {
  constructor(memoryUsage: number, memoryLimit: number) {
    super(
      `内存使用超过限制，当前${memoryUsage}字节，最大允许${memoryLimit}字节`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'MEMORY_LIMIT_EXCEEDED',
      { memoryUsage, memoryLimit },
    );
  }
}

/**
 * URL获取失败异常
 */
export class URLFetchException extends SVGParserException {
  constructor(url: string, error: string) {
    super(
      `无法获取URL内容: ${error}`,
      HttpStatus.BAD_REQUEST,
      'URL_FETCH_FAILED',
      { url, error },
    );
  }
}

/**
 * 数据转换异常
 */
export class DataTransformException extends SVGParserException {
  constructor(message: string, details?: any) {
    super(
      `数据转换失败: ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'DATA_TRANSFORM_FAILED',
      details,
    );
  }
}

/**
 * 验证失败异常
 */
export class ValidationException extends SVGParserException {
  constructor(errors: string[]) {
    super(
      `验证失败: ${errors.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      { errors },
    );
  }
}

/**
 * 不支持的SVG特性异常
 */
export class UnsupportedSVGFeatureException extends SVGParserException {
  constructor(feature: string) {
    super(
      `不支持的SVG特性: ${feature}`,
      HttpStatus.NOT_IMPLEMENTED,
      'UNSUPPORTED_FEATURE',
      { feature },
    );
  }
}

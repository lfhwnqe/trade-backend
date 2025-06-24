import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import {
  CognitoException,
  DynamoDBException,
  ValidationException,
  S3Exception,
  VectorDBException,
  AIServiceException,
} from '../exceptions/custom.exceptions';
import { ERROR_CODES } from '../constants/error-codes';
import { ErrorType } from '../interfaces/response.interface';

describe('Error Handling System', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock request object
    mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('Custom Exceptions', () => {
    it('should handle CognitoException correctly', () => {
      const exception = new CognitoException(
        'Token verification failed',
        ERROR_CODES.COGNITO_VERIFICATION_FAILED,
        '令牌验证失败，请重新登录',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '令牌验证失败，请重新登录',
          errorCode: ERROR_CODES.COGNITO_VERIFICATION_FAILED,
          errorType: ErrorType.COGNITO,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle DynamoDBException correctly', () => {
      const exception = new DynamoDBException(
        'Connection failed',
        ERROR_CODES.DYNAMODB_CONNECTION_ERROR,
        '数据库连接失败',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '数据库连接失败',
          errorCode: ERROR_CODES.DYNAMODB_CONNECTION_ERROR,
          errorType: ErrorType.DYNAMODB,
        }),
      );
    });

    it('should handle ValidationException correctly', () => {
      const exception = new ValidationException(
        'Invalid input',
        ERROR_CODES.VALIDATION_INVALID_FORMAT,
        '输入格式无效',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '输入格式无效',
          errorCode: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          errorType: ErrorType.VALIDATION,
        }),
      );
    });

    it('should handle S3Exception correctly', () => {
      const exception = new S3Exception(
        'S3 upload failed',
        ERROR_CODES.S3_UPLOAD_FAILED,
        'S3上传失败，请重试',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'S3上传失败，请重试',
          errorCode: ERROR_CODES.S3_UPLOAD_FAILED,
          errorType: ErrorType.S3,
        }),
      );
    });

    it('should handle VectorDBException correctly', () => {
      const exception = new VectorDBException(
        'Vector database connection failed',
        ERROR_CODES.VECTOR_DB_CONNECTION_ERROR,
        '向量数据库连接失败',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '向量数据库连接失败',
          errorCode: ERROR_CODES.VECTOR_DB_CONNECTION_ERROR,
          errorType: ErrorType.VECTOR_DB,
        }),
      );
    });

    it('should handle AIServiceException correctly', () => {
      const exception = new AIServiceException(
        'AI service rate limit exceeded',
        ERROR_CODES.AI_SERVICE_RATE_LIMIT,
        'AI服务请求频率超限',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'AI服务请求频率超限',
          errorCode: ERROR_CODES.AI_SERVICE_RATE_LIMIT,
          errorType: ErrorType.AI_SERVICE,
        }),
      );
    });
  });

  describe('Standard HTTP Exceptions', () => {
    it('should handle BadRequestException correctly', () => {
      const exception = new BadRequestException({
        message: ['field1 is required', 'field2 must be a string'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'field1 is required; field2 must be a string',
          errorCode: ERROR_CODES.VALIDATION_REQUIRED_FIELD,
          errorType: ErrorType.VALIDATION,
        }),
      );
    });
  });

  describe('System Exceptions', () => {
    it('should handle generic Error as system error', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '系统内部错误，请稍后重试',
          errorCode: ERROR_CODES.SYSTEM_INTERNAL_ERROR,
          errorType: ErrorType.SYSTEM,
        }),
      );
    });

    it('should detect Cognito-related errors', () => {
      const exception = new Error('Token 校验失败: invalid token');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '认证服务异常，请稍后重试',
          errorCode: ERROR_CODES.COGNITO_VERIFICATION_FAILED,
          errorType: ErrorType.COGNITO,
        }),
      );
    });

    it('should detect DynamoDB-related errors', () => {
      const exception = new Error('DynamoDB connection timeout');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '数据库操作异常，请稍后重试',
          errorCode: ERROR_CODES.DYNAMODB_CONNECTION_ERROR,
          errorType: ErrorType.DYNAMODB,
        }),
      );
    });

    it('should detect S3-related errors', () => {
      const exception = new Error('S3 bucket access denied');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'S3存储服务异常，请稍后重试',
          errorCode: ERROR_CODES.S3_UPLOAD_FAILED,
          errorType: ErrorType.S3,
        }),
      );
    });

    it('should detect Vector DB-related errors', () => {
      const exception = new Error('Vector database index error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '向量数据库服务异常，请稍后重试',
          errorCode: ERROR_CODES.VECTOR_DB_CONNECTION_ERROR,
          errorType: ErrorType.VECTOR_DB,
        }),
      );
    });

    it('should detect AI Service-related errors', () => {
      const exception = new Error('OpenAI rate limit exceeded');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'AI服务异常，请稍后重试',
          errorCode: ERROR_CODES.AI_SERVICE_UNAVAILABLE,
          errorType: ErrorType.AI_SERVICE,
        }),
      );
    });
  });
});

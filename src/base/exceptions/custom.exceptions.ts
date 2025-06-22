import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorType, ErrorDetails } from '../interfaces/response.interface';
import { ErrorCode } from '../constants/error-codes';

export class BaseCustomException extends HttpException {
  public readonly errorCode: ErrorCode;
  public readonly errorType: ErrorType;
  public readonly userMessage?: string;
  public readonly details?: any;

  constructor(
    errorDetails: ErrorDetails,
    httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(errorDetails.message, httpStatus);
    this.errorCode = errorDetails.code as ErrorCode;
    this.errorType = errorDetails.type;
    this.userMessage = errorDetails.userMessage;
    this.details = errorDetails.details;
  }
}

export class CognitoException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.COGNITO,
        message,
        userMessage: userMessage || '认证服务异常，请稍后重试',
        details,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class DynamoDBException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.DYNAMODB,
        message,
        userMessage: userMessage || '数据库操作异常，请稍后重试',
        details,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class ValidationException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.VALIDATION,
        message,
        userMessage: userMessage || '请求参数验证失败',
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class BusinessException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.BUSINESS,
        message,
        userMessage: userMessage || '业务操作失败',
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AuthenticationException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.AUTHENTICATION,
        message,
        userMessage: userMessage || '身份认证失败',
        details,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthorizationException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.AUTHORIZATION,
        message,
        userMessage: userMessage || '权限不足',
        details,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ResourceNotFoundException extends BaseCustomException {
  constructor(
    message: string,
    errorCode: ErrorCode,
    userMessage?: string,
    details?: any,
  ) {
    super(
      {
        code: errorCode,
        type: ErrorType.NOT_FOUND,
        message,
        userMessage: userMessage || '请求的资源不存在',
        details,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
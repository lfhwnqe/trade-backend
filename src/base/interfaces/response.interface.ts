export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errorCode?: string;
  errorType?: ErrorType;
  timestamp: string;
}

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  COGNITO = 'COGNITO',
  DYNAMODB = 'DYNAMODB',
  BUSINESS = 'BUSINESS',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  S3 = 'S3',
  VECTOR_DB = 'VECTOR_DB',
  AI_SERVICE = 'AI_SERVICE',
}

export interface ErrorDetails {
  code: string;
  type: ErrorType;
  message: string;
  userMessage?: string;
  details?: any;
}

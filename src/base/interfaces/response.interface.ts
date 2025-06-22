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
}

export interface ErrorDetails {
  code: string;
  type: ErrorType;
  message: string;
  userMessage?: string;
  details?: any;
}

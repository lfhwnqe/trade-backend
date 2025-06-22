# 统一错误处理机制使用指南

## 概述

本系统实现了统一的错误处理机制，包括错误分类、错误码标准化、友好错误信息返回，并专门处理 DynamoDB 异常、Cognito 异常等特定错误类型。

## 架构组成

### 1. 错误接口定义 (`response.interface.ts`)
- `ApiResponse<T>`: 统一的API响应接口
- `ErrorType`: 错误类型枚举
- `ErrorDetails`: 错误详情接口

### 2. 错误码定义 (`error-codes.ts`)
标准化的错误码常量，按照功能模块分类：
- `AUTH_*`: 认证相关错误
- `COGNITO_*`: Cognito服务相关错误
- `DYNAMODB_*`: DynamoDB相关错误
- `VALIDATION_*`: 验证相关错误
- `BUSINESS_*`: 业务逻辑错误
- `SYSTEM_*`: 系统错误
- `NETWORK_*`: 网络相关错误
- `RESOURCE_*`: 资源相关错误

### 3. 自定义异常类 (`custom.exceptions.ts`)
- `BaseCustomException`: 基础自定义异常类
- `CognitoException`: Cognito服务异常
- `DynamoDBException`: DynamoDB异常
- `ValidationException`: 验证异常
- `BusinessException`: 业务逻辑异常
- `AuthenticationException`: 认证异常
- `AuthorizationException`: 授权异常
- `ResourceNotFoundException`: 资源不存在异常

### 4. 全局异常过滤器 (`http-exception.filter.ts`)
自动处理所有类型的异常，包括：
- 自定义异常的统一处理
- HTTP异常的标准化处理
- 系统异常的友好转换
- 特定服务异常的智能识别

## 使用方法

### 1. 抛出自定义异常

```typescript
import { CognitoException, ERROR_CODES } from '@/base';

// 在服务中抛出Cognito异常
if (!token) {
  throw new CognitoException(
    'Access token is required',
    ERROR_CODES.AUTH_TOKEN_MISSING,
    '请提供访问令牌'
  );
}
```

### 2. 处理DynamoDB异常

```typescript
import { DynamoDBException, ERROR_CODES } from '@/base';

try {
  // DynamoDB操作
} catch (error) {
  throw new DynamoDBException(
    `Database operation failed: ${error.message}`,
    ERROR_CODES.DYNAMODB_CONNECTION_ERROR,
    '数据库操作失败，请稍后重试',
    { originalError: error.message }
  );
}
```

### 3. 业务异常处理

```typescript
import { BusinessException, ERROR_CODES } from '@/base';

if (user.balance < amount) {
  throw new BusinessException(
    'Insufficient balance',
    ERROR_CODES.BUSINESS_RULE_VIOLATION,
    '账户余额不足',
    { balance: user.balance, required: amount }
  );
}
```

## 错误响应格式

所有错误都会返回统一的格式：

```json
{
  "success": false,
  "error": "用户友好的错误信息",
  "errorCode": "COGNITO_001",
  "errorType": "COGNITO",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 错误类型说明

| ErrorType | 说明 | HTTP状态码 |
|-----------|------|-----------|
| VALIDATION | 参数验证错误 | 400 |
| AUTHENTICATION | 认证失败 | 401 |
| AUTHORIZATION | 权限不足 | 403 |
| NOT_FOUND | 资源不存在 | 404 |
| COGNITO | Cognito服务错误 | 401 |
| DYNAMODB | 数据库操作错误 | 500 |
| BUSINESS | 业务逻辑错误 | 400 |
| SYSTEM | 系统内部错误 | 500 |
| NETWORK | 网络连接错误 | 500 |

## 日志记录

系统会自动记录错误日志，包括：
- 请求信息（方法、URL、IP、User-Agent）
- 错误详情和堆栈信息
- 时间戳
- 500级别错误记录为ERROR级别
- 4xx级别错误记录为WARN级别

## 测试

运行测试验证错误处理机制：

```bash
npm test src/base/test/error-handling.test.ts
```

## 最佳实践

1. **使用合适的异常类型**: 根据错误的性质选择合适的自定义异常类
2. **提供友好的用户消息**: userMessage应该是用户可以理解的中文消息
3. **包含详细的技术信息**: message应该包含足够的技术细节用于调试
4. **使用标准错误码**: 从ERROR_CODES常量中选择合适的错误码
5. **传递额外上下文**: 通过details参数传递有助于调试的额外信息

## 扩展指南

### 添加新的错误类型

1. 在 `ErrorType` 枚举中添加新类型
2. 在 `ERROR_CODES` 中添加相应的错误码
3. 创建对应的自定义异常类（如果需要）
4. 在 `HttpExceptionFilter` 中添加特定处理逻辑（如果需要）

### 添加新的错误码

在 `error-codes.ts` 中按照现有模式添加：

```typescript
export const ERROR_CODES = {
  // ... 现有错误码
  NEW_MODULE_ERROR: 'NEW_MODULE_001',
} as const;
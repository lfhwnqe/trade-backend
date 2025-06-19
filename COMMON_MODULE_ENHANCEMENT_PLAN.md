# Common 模块增强实施计划

## 项目概述
为 `src/modules/common` 模块增加通用的装饰器、过滤器、格式化器和错误处理器，提升代码的可维护性、一致性和开发效率。

## 当前状态分析

### 现有文件
- `auth.middleware.ts` - 认证中间件
- `cognito.service.ts` - Cognito 认证服务
- `config.service.ts` - 配置服务
- `common.module.ts` - 模块定义

### 现有基础设施
- `src/base/filters/http-exception.filter.ts` - HTTP 异常过滤器
- `src/base/interfaces/response.interface.ts` - 响应接口定义

### 当前问题
1. **响应格式不统一**：控制器中手动构造响应格式，如 `{ success: true, data }` vs `{ message: '...', userId: '...', confirmed: true }`
2. **错误处理分散**：认证中间件、控制器中都有各自的错误处理逻辑
3. **重复代码**：用户信息获取 `(req as any).user?.sub` 在多个控制器中重复
4. **缺少统一的权限控制**：注释掉的角色守卫和权限装饰器
5. **API 文档不规范**：Swagger 文档缺少统一的响应示例

## 详细实施计划

### 阶段一：核心基础设施 (优先级：高)

#### 1.1 响应格式标准化
**目标**：统一所有 API 的响应格式
**文件**：
- `src/modules/common/interfaces/response.interface.ts` (扩展现有)
- `src/modules/common/interfaces/pagination.interface.ts`
- `src/modules/common/utils/response.helper.ts`
- `src/modules/common/interceptors/response.interceptor.ts`
- `src/modules/common/decorators/api-response.decorator.ts`

**功能**：
```typescript
// 标准成功响应
{
  success: true,
  data: T,
  message?: string,
  timestamp: string
}

// 标准分页响应
{
  success: true,
  data: {
    items: T[],
    pagination: {
      page: number,
      pageSize: number,
      total: number,
      hasNext: boolean
    }
  },
  timestamp: string
}

// 标准错误响应
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  },
  timestamp: string
}
```

#### 1.2 异常处理增强
**目标**：统一和增强错误处理机制
**文件**：
- `src/modules/common/exceptions/business.exception.ts`
- `src/modules/common/exceptions/trade.exception.ts`
- `src/modules/common/filters/business-exception.filter.ts`
- `src/modules/common/filters/validation-exception.filter.ts`

**功能**：
- 业务异常类型化
- 详细的错误代码和消息
- 多语言错误消息支持
- 验证错误的友好格式化

#### 1.3 用户信息装饰器
**目标**：简化用户信息获取
**文件**：
- `src/modules/common/decorators/current-user.decorator.ts`
- `src/modules/common/interfaces/user.interface.ts`

**功能**：
```typescript
// 替换 (req as any).user?.sub
@Get('profile')
async getProfile(@CurrentUser() user: UserInfo) {
  return user;
}

@Get('trades')
async getTrades(@CurrentUser('sub') userId: string) {
  return this.tradeService.findByUserId(userId);
}
```

### 阶段二：权限控制系统 (优先级：高)

#### 2.1 角色权限装饰器和守卫
**目标**：实现完整的角色权限控制
**文件**：
- `src/modules/common/decorators/roles.decorator.ts`
- `src/modules/common/guards/roles.guard.ts`
- `src/modules/common/guards/admin.guard.ts`

**功能**：
```typescript
@Roles('admin')
@Get('users')
async getAllUsers() { }

@AdminOnly()
@Patch('registration/status')
async updateRegistrationStatus() { }
```

#### 2.2 权限增强的认证中间件
**目标**：增强现有认证中间件
**文件**：
- `src/modules/common/auth.middleware.ts` (更新现有)

**功能**：
- 角色信息解析
- 权限缓存
- 更详细的日志

### 阶段三：开发体验优化 (优先级：中)

#### 3.1 API 文档标准化装饰器
**目标**：统一 Swagger 文档格式
**文件**：
- `src/modules/common/decorators/api-docs.decorator.ts`

**功能**：
```typescript
@ApiStandardResponse('获取交易记录', TradeEntity)
@ApiPaginatedResponse('交易列表', TradeEntity)
@ApiErrorResponses(['TRADE_NOT_FOUND', 'UNAUTHORIZED'])
```

#### 3.2 验证和转换管道
**目标**：简化数据验证和转换
**文件**：
- `src/modules/common/pipes/query-validation.pipe.ts`
- `src/modules/common/pipes/transform.pipe.ts`
- `src/modules/common/validators/trade-status.validator.ts`
- `src/modules/common/validators/date-range.validator.ts`

**功能**：
- 查询参数自动验证和转换
- 业务规则验证器
- 类型安全的数据转换

#### 3.3 分页和查询助手
**目标**：标准化分页和查询处理
**文件**：
- `src/modules/common/utils/pagination.helper.ts`
- `src/modules/common/decorators/paginated.decorator.ts`

**功能**：
- 自动分页参数处理
- DynamoDB 分页适配
- 查询条件构建器

### 阶段四：监控和日志 (优先级：中)

#### 4.1 结构化日志系统
**目标**：统一日志格式和管理
**文件**：
- `src/modules/common/services/logger.service.ts`
- `src/modules/common/interceptors/logging.interceptor.ts`
- `src/modules/common/decorators/audit-log.decorator.ts`

**功能**：
- 结构化日志输出
- 请求追踪
- 操作审计日志
- Lambda 友好的日志格式

#### 4.2 性能监控
**目标**：API 性能追踪
**文件**：
- `src/modules/common/interceptors/performance.interceptor.ts`
- `src/modules/common/decorators/performance.decorator.ts`

**功能**：
- 响应时间监控
- 数据库查询性能追踪
- 内存使用监控

### 阶段五：高级功能 (优先级：低)

#### 5.1 缓存系统
**目标**：简化缓存操作
**文件**：
- `src/modules/common/services/cache.service.ts`
- `src/modules/common/decorators/cache.decorator.ts`

**功能**：
- 方法级缓存装饰器
- 用户级缓存
- 缓存失效策略

#### 5.2 请求限流和安全
**目标**：API 安全增强
**文件**：
- `src/modules/common/guards/rate-limit.guard.ts`
- `src/modules/common/middleware/security.middleware.ts`

**功能**：
- 请求频率限制
- 安全头设置
- 输入清理

## 实施时间线

### 第 1-2 周：阶段一
- 响应格式标准化
- 异常处理增强
- 用户装饰器

### 第 3 周：阶段二
- 角色权限系统
- 认证中间件增强

### 第 4 周：阶段三
- API 文档标准化
- 验证管道
- 分页助手

### 第 5 周：阶段四
- 日志系统
- 性能监控

### 第 6 周：阶段五
- 缓存系统
- 安全增强

## 影响范围评估

### 需要更新的现有文件
1. **控制器文件**：
   - `src/modules/user/user.controller.ts`
   - `src/modules/trade/trade.controller.ts`
   - `src/modules/image/image.controller.ts`

2. **应用配置**：
   - `src/app.module.ts` - 全局过滤器、拦截器、守卫注册
   - `src/main.ts` - 全局管道、过滤器配置

3. **模块文件**：
   - 各功能模块需要导入和配置新的通用功能

### 向后兼容性
- 现有 API 响应格式将通过拦截器自动转换
- 渐进式迁移，不影响现有功能
- 可选的装饰器使用，不强制重构

## 预期收益

### 开发效率提升
- 减少 70% 的重复代码
- 统一的错误处理减少调试时间
- 标准化装饰器提升开发速度

### 代码质量改善
- 类型安全的用户信息获取
- 统一的权限控制
- 标准化的 API 文档

### 维护性增强
- 集中的配置管理
- 统一的日志格式
- 可测试的业务逻辑

## 风险评估

### 技术风险
- **低风险**：基于 NestJS 标准模式，成熟稳定
- **迁移风险**：渐进式迁移，可控

### 性能影响
- **拦截器开销**：可忽略的性能影响
- **装饰器开销**：编译时处理，无运行时开销

### 学习成本
- **团队学习成本**：中等，需要 1-2 天适应
- **文档支持**：提供详细的使用示例和最佳实践

## 后续扩展计划

### 集成计划
- **前端集成**：标准化的错误码和消息格式
- **监控集成**：CloudWatch 日志聚合
- **测试集成**：单元测试和集成测试模板

### 社区贡献
- 抽取通用部分作为独立的 npm 包
- 贡献到 NestJS 社区生态

---

**总结**：这个增强计划将显著提升项目的代码质量、开发效率和维护性，为项目的长期发展奠定坚实基础。建议按阶段实施，优先完成核心基础设施和权限控制系统。
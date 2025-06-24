# SVG解析引擎模块

## 概述

SVG解析引擎模块是一个功能完善的SVG文件解析系统，专门设计用于解析Whimsical脑图等复杂SVG文件，并将其转换为标准化的图数据结构。

## 功能特性

### 核心功能
- ✅ **SVG DOM解析**: 支持完整的SVG元素解析，包括节点、边、连接器
- ✅ **多种输入方式**: 支持URL、文件上传、字符串输入
- ✅ **数据转换**: 将SVG元素转换为标准图数据模型
- ✅ **Graphology集成**: 支持使用graphology库进行内存图构建
- ✅ **数据清洗与验证**: 自动清洗重复数据，验证数据完整性

### 性能优化
- ✅ **性能监控**: 实时监控解析时间、内存使用、节点数量
- ✅ **超时控制**: 可配置的解析超时时间（默认30秒）
- ✅ **节点限制**: 支持最大1000个节点的脑图解析
- ✅ **内存限制**: 内存使用控制在512MB以内

### 错误处理
- ✅ **完善的异常体系**: 自定义异常类型，详细错误信息
- ✅ **错误分级**: 支持错误、警告、信息三个级别
- ✅ **日志记录**: 详细的解析过程日志和性能指标记录
- ✅ **优雅降级**: 解析失败时提供详细的错误信息和建议

## API接口

### 1. 解析SVG字符串
```http
POST /svg-parser/parse-string
Content-Type: application/json

{
  "svgContent": "<svg>...</svg>",
  "options": {
    "extractText": true,
    "extractStyles": true,
    "extractTransforms": true,
    "maxNodes": 1000,
    "timeout": 30000
  }
}
```

### 2. 从URL解析SVG
```http
POST /svg-parser/parse-url
Content-Type: application/json

{
  "url": "https://example.com/mindmap.svg",
  "options": {
    "extractText": true,
    "extractStyles": true
  }
}
```

### 3. 上传文件解析
```http
POST /svg-parser/parse-file
Content-Type: multipart/form-data

file: [SVG文件]
options: {"extractText": true}
```

### 4. 验证SVG格式
```http
POST /svg-parser/validate
Content-Type: application/json

{
  "svgContent": "<svg>...</svg>"
}
```

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "node1",
        "label": "节点1",
        "type": "concept",
        "position": {"x": 50, "y": 50},
        "size": {"width": 100, "height": 60},
        "style": {"fill": "#ff6b6b", "stroke": "#333"},
        "properties": {...}
      }
    ],
    "edges": [
      {
        "id": "edge1",
        "source": "node1",
        "target": "node2",
        "type": "explicit",
        "style": {"stroke": "#333", "strokeWidth": 2},
        "properties": {...}
      }
    ],
    "metadata": {
      "nodeCount": 3,
      "edgeCount": 2,
      "sourceFormat": "SVG",
      "createdAt": "2024-06-24T12:00:00.000Z",
      "version": "1.0"
    }
  },
  "errors": [],
  "metrics": {
    "parseTime": 150,
    "memoryUsage": 1048576,
    "nodeCount": 3,
    "edgeCount": 2,
    "elementCount": 5
  }
}
```

### 错误响应
```json
{
  "success": false,
  "errors": [
    {
      "code": "INVALID_SVG_FORMAT",
      "message": "SVG格式无效",
      "severity": "error",
      "element": "svg",
      "line": 1
    }
  ],
  "metrics": {
    "parseTime": 50,
    "memoryUsage": 524288,
    "nodeCount": 0,
    "edgeCount": 0,
    "elementCount": 0
  }
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| extractText | boolean | true | 是否提取文本内容 |
| extractStyles | boolean | true | 是否提取样式信息 |
| extractTransforms | boolean | true | 是否提取变换信息 |
| ignoreHiddenElements | boolean | true | 是否忽略隐藏元素 |
| maxNodes | number | 1000 | 最大节点数量 |
| timeout | number | 30000 | 解析超时时间(毫秒) |
| validateStructure | boolean | true | 是否验证结构 |

## 支持的SVG元素

### 节点元素
- `<rect>` - 矩形节点
- `<circle>` - 圆形节点
- `<ellipse>` - 椭圆节点
- `<polygon>` - 多边形节点
- `<path>` - 路径节点
- `<text>` - 文本节点
- `<g>` - 分组节点

### 连接元素
- `<line>` - 直线连接
- `<polyline>` - 折线连接
- `<path>` - 路径连接

## 测试

### 运行单元测试
```bash
npm test -- --testPathPattern=svg-parser.service.spec.ts
```

### 运行集成测试
```bash
npm test -- --testPathPattern=svg-parser.integration.spec.ts
```

### 运行端到端测试
```bash
npm test -- --testPathPattern=svg-parser.e2e.spec.ts
```

## 性能指标

- **解析速度**: 简单SVG < 100ms，复杂SVG < 5s
- **内存使用**: 典型使用 < 50MB，最大限制 512MB
- **节点支持**: 最大1000个节点
- **并发支持**: 支持多个并发解析请求

## 错误代码

| 错误代码 | 描述 |
|----------|------|
| INVALID_SVG_FORMAT | SVG格式无效 |
| PARSE_TIMEOUT | 解析超时 |
| FILE_TOO_LARGE | 文件过大 |
| TOO_MANY_NODES | 节点数量超限 |
| MEMORY_LIMIT_EXCEEDED | 内存使用超限 |
| URL_FETCH_FAILED | URL获取失败 |
| DATA_TRANSFORM_FAILED | 数据转换失败 |
| VALIDATION_FAILED | 验证失败 |

## 使用示例

### TypeScript示例
```typescript
import { SVGParserService } from './svg-parser.service';

const svgParser = new SVGParserService(/* dependencies */);

const result = await svgParser.parseSVG({
  input: svgContent,
  inputType: 'string',
  options: {
    extractText: true,
    extractStyles: true,
    maxNodes: 500,
    timeout: 15000
  }
});

if (result.success) {
  console.log(`解析成功: ${result.data.nodes.length}个节点`);
  console.log(`性能指标: ${result.metrics.parseTime}ms`);
} else {
  console.error('解析失败:', result.errors);
}
```

## 架构设计

```
SVGParserController
    ↓
SVGParserService
    ↓
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ SVGElementExtractor │ DataTransformService │ ValidationService   │
└─────────────────────┴─────────────────────┴─────────────────────┘
    ↓                       ↓                       ↓
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ PerformanceMonitor  │ LoggingService      │ ExceptionFilters    │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

## 扩展性

模块设计采用依赖注入和服务分离的架构，便于扩展：

1. **新的SVG元素支持**: 在`SVGElementExtractorService`中添加新的元素处理逻辑
2. **新的输出格式**: 在`DataTransformService`中添加新的转换逻辑
3. **新的验证规则**: 在`ValidationService`中添加新的验证逻辑
4. **新的性能指标**: 在`PerformanceMonitorService`中添加新的监控指标

## 注意事项

1. **内存管理**: 处理大型SVG文件时注意内存使用
2. **超时设置**: 根据实际需求调整超时时间
3. **错误处理**: 始终检查解析结果的success字段
4. **性能监控**: 关注metrics中的性能指标
5. **日志记录**: 生产环境中启用适当的日志级别

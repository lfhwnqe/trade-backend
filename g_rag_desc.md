# 基于TypeScript与AWS Serverless的知识图谱系统架构设计

# 第一部分：系统概述与顶层设计

## 1.1. 知识图谱系统简介

本报告旨在为基于TypeScript和AWS Serverless生态系统构建一个功能完备、成本可控的知识图谱系统提供一份详尽的架构蓝图。该系统的核心价值在于将源自可视化协作工具（如Whimsical脑图）中的非结构化知识，转化为一个结构化、可查询、并由人工智能增强的智能资产。

系统的设计遵循“无服务器优先”（Serverless-First）的原则，充分利用AWS Lambda、Amazon DynamoDB等托管服务，旨在最大程度地减少运维开销，实现按需伸缩，并优化成本效益。本架构的核心技术栈包括：

-   **知识源输入**: 以Whimsical等在线协作工具中的脑图作为知识的主要来源。
-   **计算核心**: 采用AWS Lambda承载所有业务逻辑，以TypeScript作为主要开发语言，确保代码的类型安全与可维护性。
-   **图数据存储**: 选用Amazon DynamoDB作为图数据库，通过高级数据建模技术（邻接表模式）实现低成本、高可扩展的图结构存储。
-   **智能交互层**: 集成大型语言模型（LLM），如Amazon Bedrock或OpenAI的服务，实现对知识图谱的自然语言查询与智能分析。

## 1.2. 系统高层架构图

下图展示了本知识图谱系统的端到端数据流与核心组件交互。

```
[Whimsical脑图] --> [触发事件] --> [MindMapParserFunction (Lambda)]
                                       |
                                       v
                +---------------------> <-------------------------+
                |                     [Graph Database (DynamoDB)] |
                |                                                 ^
                v                                                 |
[用户自然语言查询] -> [KnowledgeAgentFunction (Lambda)] -> [GraphQueryFunction (Lambda)]
      ^                                                            |
      |                                                            v
      +<-------------------------- [LLM服务] <-----------------------+

```

### 架构组件说明:

-   **Whimsical脑图**: 知识的初始来源，包含节点、连接、文本、颜色等丰富的视觉信息。
-   **触发事件**: 启动数据抽取流程的事件源。这可以是一个手动的API调用，或是一个自动化的触发器（例如，将导出的文件上传到S3存储桶时触发）。
-   **MindMapParserFunction (Lambda)**: 核心的数据抽取与转换函数。负责获取脑图数据（通过SVG导出），解析其结构，将其转换为标准的图数据模型（节点与边），并写入DynamoDB。
-   **Graph Database (DynamoDB)**: 系统的持久化存储层。采用单表设计，通过邻接表模式（Adjacency List Pattern）来高效地存储和检索图的节点与关系数据。
-   **GraphQueryFunction (Lambda)**: 封装了所有与DynamoDB中图数据交互的逻辑。它提供了一个标准化的接口，用于执行如图遍历、邻居查找等操作。
-   **KnowledgeAgentFunction (Lambda)**: 作为系统的智能大脑，该函数负责协调用户、图查询服务与LLM之间的交互。它接收用户的自然语言查询，借助LLM生成查询计划，调用GraphQueryFunction执行查询，并将结构化的图数据再次提交给LLM以生成最终的自然语言回答。
-   **LLM服务**: 提供自然语言理解、推理和生成能力的外部大模型服务，是实现智能问答的关键。

## 1.3. 核心设计原则

本架构的设计遵循以下几个核心原则：

-   **无服务器优先 (Serverless-First)**: 全面拥抱AWS的无服务器计算与存储服务。通过使用AWS Lambda和DynamoDB，系统能够根据实际负载自动扩展或缩减资源，开发者无需管理底层服务器，从而极大地降低了运维复杂度和成本。
-   **成本效益 (Cost-Effectiveness)**: 架构的每一个决策都将成本控制作为重要考量。选择DynamoDB而非专用的图数据库（如Amazon Neptune）是这一原则的直接体现。DynamoDB的按需付费模式和慷慨的免费套餐，使其在处理不规则或低频访问负载时具有显著的成本优势。
-   **可扩展性 (Scalability)**: 系统的各个组件均设计为可独立扩展。AWS Lambda可以处理海量的并发请求，而DynamoDB的单表设计模式在正确实施的情况下，能够支持几乎无限的数据增长和高并发访问。
-   **模块化 (Modularity)**: 架构遵循关注点分离的原则，将数据抽取（Ingestion）、存储（Storage）、查询（Query）和智能处理（AI）等功能解耦到不同的Lambda函数中。这种模块化的设计使得各部分可以独立开发、测试、部署和维护，提高了整个系统的灵活性和可维护性。

---

# 第二部分：数据抽取管道——从脑图到图谱

本部分将详细阐述系统的第一个关键环节：如何将一个视觉化的、为人类设计的脑图，高效、准确地转换为机器可读的结构化图数据。

## 2.1. Whimsical作为数据源：导出选项分析

一个核心挑战在于，Whimsical并未提供官方的、用于直接导出结构化数据（如JSON）的API。因此，必须制定一种可靠的数据抽取策略。

### 选项一：基于文本的导出 (复制/粘贴)

-   **流程**: Whimsical支持选中一个脑图节点后，使用“特殊粘贴”（Ctrl+Shift+V或Command+Shift+V）功能，将其及其所有子节点以带缩进的纯文本列表形式粘贴出来。
-   **分析**: 此方法虽然简单，但数据损失严重。它仅保留了节点的文本内容和层级关系，却完全丢失了位置、颜色、图标、连接线样式与标签等关键元数据。在知识图谱构建中，这些视觉元素往往承载着重要的语义信息。例如，用户可能习惯用蓝色节点表示“项目”，绿色节点表示“人员”。若丢失颜色信息，则无法自动推断节点类型，大大降低了图谱的丰富度。因此，该方法不适用于构建高质量的知识图谱。

### 选项二：基于图像的导出 (PNG/PDF)

-   **流程**: Whimsical提供标准的PNG和PDF导出功能。
-   **分析**: 此方法完全不适用于结构化数据提取。它需要借助复杂且易错的OCR（光学字符识别）和图像分析技术来识别节点和连接，可靠性极低。因此，该方案直接被排除。

### 选项三（推荐）：SVG导出与解析

-   **流程**: Whimsical提供一个“实验性”但功能强大的导出方式：在脑图的URL末尾追加`/svg`，即可在浏览器中生成该脑图的SVG（可缩放矢量图形）表示。
-   **分析**: 这是本系统数据抽取的关键所在。SVG是一种基于XML的开放标准格式，这意味着脑图的所有视觉元素——包括节点（如`<rect>`, `<g>`）、文本（`<text>`）和连接线（`<path>`）——都被以一种结构化、层次化的方式保存在了文档中。这为我们提供了进行高保真度数据提取的可能。通过解析SVG的XML结构，我们不仅能获取节点的文本和关系，还能精确提取其坐标、尺寸、颜色、形状等所有元数据。这种方法的保真度远超其他选项，是构建高质量、语义丰富的知识图谱的理想起点。

## 2.2. SVG解析策略与实现

基于SVG导出的可行性，我们设计一个专门的AWS Lambda函数（`MindMapParserFunction`）来自动化完成整个解析流程。

### 第一步：获取SVG内容

由于直接访问`/svg`链接可能需要用户登录状态，为了实现完全自动化，该Lambda函数需要借助一个无头浏览器库（如Puppeteer）来模拟用户登录Whimsical并访问目标脑图的SVG链接。开源社区中存在的`whimsical-exporter`工具已经验证了此方法的可行性与稳定性。这意味着，我们的系统可以从一个手动的工具演变为一个自动化的平台。此步骤也带来了安全上的考量，Whimsical的凭证需要被安全地管理，例如存储在AWS Secrets Manager中，并在Lambda执行时动态获取。

### 第二步：解析SVG的XML结构

获取到SVG的文本内容后，使用一个兼容TypeScript的XML/SVG解析库，如`svg-parser`或浏览器环境（在Puppeteer中）内置的 `DOMParser`，来将SVG字符串转换成一个可遍历的DOM树。

### 第三步：提取图元素

-   **节点 (Nodes)**: 遍历SVG DOM树，识别代表节点的元素（通常是`<g>`元素包裹着`<rect>`或`<ellipse>`以及`<text>`）。从这些元素中提取关键属性，如唯一的`id`、位置信息（`transform`属性中的`translate(x, y)`）、尺寸（`width`, `height`）以及样式属性（如`fill`代表颜色）。
-   **文本 (Text)**: 定位`<text>`元素，并根据其坐标与父级容器的坐标关系，将其与对应的节点关联起来，作为节点的内容或标签。
-   **边 (Edges)**: 识别代表连接线的`<path>`元素。解析其`d`属性（路径数据），可以得到路径的起点、终点和控制点。通过计算这些点与各个节点边界框的距离，可以精确地将边的两端与源节点和目标节点关联起来。同时，提取`stroke`（颜色）、`stroke-width`（粗细）等样式信息。
-   **关系 (Relationships)**: 识别那些位于`<path>`元素中点附近的`<text>`元素，将其内容提取为边的标签（即关系类型）。

## 2.3. 内存中的图表示

在将解析出的数据写入数据库之前，最佳实践是先在内存中构建一个清晰、规范的图对象。这有助于数据清洗、验证和后续的转换。

-   **库选择**: 推荐使用功能强大且性能优越的TypeScript图处理库。`graphology` 是一个绝佳的选择，它支持多种图类型，拥有丰富的算法库，并且与 `sigma.js`等可视化库深度集成。其他备选方案包括 `typescript-graph` 或 `graph-data-structure`。

-   **实现**:
    1.  在`MindMapParserFunction`中，实例化一个`graphology`的`Graph`对象。
    2.  遍历从SVG中解析出的元素。
    3.  对于每一个识别出的节点，调用`graph.addNode(nodeId, { ...attributes })`方法，将其属性（如内容、颜色、位置等）作为节点的元数据存入。
    4.  对于每一个识别出的边，调用`graph.addEdge(sourceNodeId, targetNodeId, { ...attributes })`方法，创建节点间的连接，并将边的属性（如标签、样式）存入。

经过这一步，我们就获得了一个标准化的、经过验证的、可在代码中轻松操作的图对象，为下一步持久化到DynamoDB做好了充分准备。

---

# 第三部分：图数据持久化——低成本、高扩展的DynamoDB设计

本部分将深入探讨知识图谱的存储核心，阐述为何选择DynamoDB，并详细解释如何通过高级数据建模技术，使其胜任图数据存储的重任。

## 3.1. 为何选择DynamoDB存储图数据？成本与能力的权衡

为知识图谱选择数据库时，面临一个核心的权衡：是选择功能强大的原生图数据库，还是选择成本效益更优的通用NoSQL数据库。

### 原生图数据库的优势与成本

Amazon Neptune是AWS提供的全托管图数据库服务，原生支持Gremlin、openCypher等图查询语言，能够高效处理复杂的多跳查询和图算法。Neo4j也是业界领先的图数据库，同样提供强大的图查询能力。

然而，这些专用数据库的成本相对较高。以Neptune Serverless为例，虽然它能自动伸缩并按需付费，但其最小计费单位（NCU, Neptune Capacity Unit）的启动成本和单位价格，通常高于DynamoDB的按需模式。对于初创项目或内部工具这类对成本敏感的应用，这可能是一笔不小的开销。

### DynamoDB的优势与挑战

-   **成本优势**: DynamoDB的按需模式（On-Demand）真正实现了按请求付费，对于流量不规则或初期流量较小的应用场景，成本极低。其慷慨的永久免费套餐也为项目启动提供了零成本的可能。
-   **Serverless生态集成**: 作为AWS核心服务，DynamoDB与AWS Lambda、API Gateway、IAM等无服务器组件无缝集成，简化了架构设计和权限管理。
-   **挑战**: DynamoDB本身是一个键值/文档数据库，并非原生图数据库。它不提供图查询语言或内置的图遍历引擎。因此，所有复杂的图查询逻辑都必须在应用层（即Lambda函数中）自行实现。

### 架构决策

综合考虑用户查询中“低成本”这一核心要求，本架构选择Amazon DynamoDB作为图数据存储方案。我们接受在应用层增加查询复杂度的挑战，以换取极致的成本效益和与AWS Serverless生态的深度融合。

> **必须明确**：此架构中DynamoDB的角色是高性能、可扩展的图存储引擎，而非原生图数据库。这一设计决策是在数据库的查询能力与极致的成本效益及无服务器运维便利性之间做出的权衡。

## 3.2. 邻接表模式：在DynamoDB中构建图

为了在DynamoDB中高效地表示图结构，我们采用“邻接表模式”（Adjacency List Pattern）。这是DynamoDB单表设计中的一种高级模式，其核心思想是通过重载主键（Partition Key 和 Sort Key）来在同一张表中存储不同类型的实体（节点和边），并利用“项目集合”（Item Collection）的特性来“预连接”（pre-join）相关数据。

### 表结构定义

-   **表名**: `KnowledgeGraph`
-   **主键**: 复合主键
    -   **分区键 (PK)**: `string` 类型。用于存储节点的唯一标识符。
    -   **排序键 (SK)**: `string` 类型。用于存储项目的类型信息及其与其他实体的关系。

### 项目表示方法

#### 节点项目 (Node Item)
代表图中的一个实体，即脑图中的一个节点。
-   **PK**: `NODE#<node_id>` (例如: `NODE#A1B2C3`)
-   **SK**: `METADATA#<node_id>` (例如: `METADATA#A1B2C3`)
-   **其他属性**: `nodeType` (节点类型，可从SVG颜色推断), `content` (节点文本), `color`, `x_pos`, `y_pos`, `createdAt` 等从SVG解析出的所有元数据。

> **设计解析**: 这种结构允许我们通过`GetItem` API并提供完整的PK和SK，来精确、高效地获取任意一个节点的元数据。SK中的`METADATA#`前缀用于将其与边项目区分开来。此模式借鉴了成熟的DynamoDB设计实践。

#### 边项目 (Edge Item)
代表两个节点之间的有向关系。
-   **PK**: `NODE#<source_node_id>` (源节点的ID)
-   **SK**: `EDGE#<relationship_type>#<target_node_id>` (例如: `EDGE#CONNECTS_TO#D4E5F6`)
-   **其他属性**: `label` (关系标签), `weight` (权重), `direction` (方向), `createdAt` 等。

> **设计解析**: 这是邻接表模式的核心。所有从同一个源节点出发的边，都拥有相同的分区键（PK）。在DynamoDB中，所有具有相同PK的项目构成一个“项目集合”。这意味着，我们可以通过一次`Query`操作（指定PK），获取到一个节点本身（元数据项目）以及所有从它出发的边（边项目）。这就在物理层面实现了数据的“预连接”，避免了传统数据库中的JOIN操作。

### DynamoDB单表设计模式下的数据模型

下表直观地展示了本架构中`KnowledgeGraph`表的核心数据模型，清晰地定义了节点和边两种项目类型的主键结构以及GSI键的生成规则。这是实现图数据存储与高效双向查询的基石。

| 项目类型 | 分区键 (PK) | 排序键 (SK) | GSI1分区键 (GSI1PK) | GSI1排序键 (GSI1SK) | 其他关键属性 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **节点 (Node)** | `NODE#<nodeId>` | `METADATA#<nodeId>` | (不填充) | (不填充) | `data`, `nodeType`, `content`, `color`, `createdAt` |
| **边 (Edge)** | `NODE#<sourceNodeId>` | `EDGE#<relationshipType>#<targetNodeId>` | `NODE#<targetNodeId>` | `EDGE#<relationshipType>#<sourceNodeId>` | `label`, `weight`, `direction`, `createdAt` |


## 3.3. 全局二级索引 (GSI)：实现高效双向遍历

**问题**: 上述主键设计高效地解决了“查询一个节点的所有出边”（`source -> target`）的需求。但如何高效地查询“一个节点的所有入边”（`? -> target`）呢？如果使用全表扫描（Scan），其成本和延迟将随着表的增大而变得无法接受。

**解决方案：反向索引模式 (Inverted Index Pattern)**: 我们通过创建一个全局二级索引（GSI），并将边项目的主键和排序键中的源/目标节点ID进行“翻转”来解决这个问题。

### GSI结构定义:

-   **索引名称**: `gsi1`
-   **分区键 (GSI1PK)**: `string` 类型
-   **排序键 (GSI1SK)**: `string` 类型

### 填充GSI:

在创建**边项目 (Edge Item)**时，除了PK和SK，我们还需要额外添加两个属性：
-   `GSI1PK`: `NODE#<target_node_id>`
-   `GSI1SK`: `EDGE#<relationship_type>#<source_node_id>`

> **设计解析**: 在GSI中，我们将目标节点ID作为分区键。这样，所有指向同一个目标节点的边，在GSI中就会被组织到同一个新的项目集合里。通过查询这个GSI（指定GSI1PK），我们就能高效地找到一个指定节点的所有父节点及其关系，从而实现了高效的反向查找。

## 3.4. 数据转换与加载逻辑 (TypeScript)

在`MindMapParserFunction` Lambda函数中，需要包含一个转换模块，负责将内存中的`graphology`图对象转换为可供DynamoDB `BatchWriteItem` API使用的`PutRequest`项目数组。

```typescript
// 伪代码示例，位于MindMapParserFunction内部
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Graph } from 'graphology';

// 假设graph是已填充的graphology对象
async function persistGraphToDynamoDB(graph: Graph) {
  const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const tableName = process.env.TABLE_NAME;
  let putRequests = [];

  // 1. 转换节点
  graph.forEachNode((nodeId, attributes) => {
    putRequests.push({
      PutRequest: {
        TableName: tableName,
        Item: {
          PK: `NODE#${nodeId}`,
          SK: `METADATA#${nodeId}`,
          ...attributes, // 包含content, color, x_pos等所有属性
          EntityType: 'Node',
        },
      },
    });
  });

  // 2. 转换边
  graph.forEachEdge((edgeKey, attributes, sourceId, targetId, sourceNode, targetNode) => {
    const { relationshipType = 'RELATED_TO', ...edgeAttributes } = attributes;
    putRequests.push({
      PutRequest: {
        TableName: tableName,
        Item: {
          PK: `NODE#${sourceId}`,
          SK: `EDGE#${relationshipType}#${targetId}`,
          GSI1PK: `NODE#${targetId}`, // 填充GSI键
          GSI1SK: `EDGE#${relationshipType}#${sourceId}`,
          ...edgeAttributes, // 包含label, weight等
          EntityType: 'Edge',
        },
      },
    });
  });

  // 3. 分批写入DynamoDB (BatchWriteItem有25个项目的限制)
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch,
      },
    });
    await ddbDocClient.send(command);
  }
}
```
此代码片段展示了如何使用AWS SDK for JavaScript v3将图数据结构化并准备批量写入DynamoDB，这是实现持久化的核心逻辑。

## 3.5. 设计约束与考量

一个必须正视的设计约束是DynamoDB的项目集合大小限制。一个分区键（PK）下的所有项目（即一个项目集合）的总大小不能超过10GB。在我们的设计中，这意味着如果脑图中的某一个“超级节点”拥有过多的直接连接（边），导致其对应的所有 `Edge Item`的总大小超过10GB，系统将无法写入新的边，从而导致写入失败。这个问题被称为“热点分区”（Hot Partition）。

虽然对于典型的脑图应用来说，这种情况发生的概率较低，但这定义了当前架构模式的扩展性边界。对于需要处理具有数百万连接的超级节点的场景，必须考虑更高级的模式，如“写分片”（Write Sharding），即将PK进行扩展（例如，`NODE#<nodeId>#1`, `NODE#<nodeId>#2`...），将一个逻辑上的项目集合分散到多个物理分区中。这是对所选技术局限性的深刻理解，也是未来系统演进时需要考虑的关键点。

---

# 第四部分：图遍历与查询逻辑

在将图数据成功持久化到DynamoDB之后，下一步是构建一个高效、可靠的查询层。本部分将详细介绍如何实现对存储在DynamoDB中的图数据进行各种模式的查询和遍历。

## 4.1. GraphQueryFunction: 集中化的数据访问层

为了遵循良好的软件工程实践，我们将所有与图数据交互的逻辑封装在一个专用的AWS Lambda函数中，命名为`GraphQueryFunction`。这种做法将数据访问层与上层的业务逻辑（如LLM交互）分离开来，使得系统更加模块化和易于维护。

该函数将通过一个定义良好的接口接收结构化的请求，并返回结构化的JSON响应。例如，一个请求可能如下所示：

```json
{
  "operation": "getNodeAndNeighbors",
  "nodeId": "A1B2C3",
  "depth": 1
}
```

## 4.2. 查询模式一：获取节点及其一跳邻居

这是最基础也是最高频的图查询操作，例如“显示‘Serverless’节点及其所有直接关联的节点”。

### 实现策略:

1.  **查询主表获取出边**: 使用DynamoDB的`Query` API，以`PK = NODE#<nodeId>`作为键条件表达式（KeyConditionExpression）。由于邻接表的设计，这次查询将原子性地返回该节点的元数据项目以及所有从该节点出发的边项目。这是一个极其高效的操作。
2.  **查询GSI获取入边**: 使用`Query` API，但这次针对`gsi1`索引，以`GSI1PK = NODE#<nodeId>`作为键条件表达式。这将高效地返回所有指向该节点的边项目。
3.  **结果聚合**: `GraphQueryFunction`将上述两次查询的结果进行聚合。它解析出所有相关的邻居节点ID，并可以选择性地进一步获取这些邻居节点的元数据，最终返回一个包含中心节点、邻居节点和它们之间关系的完整一跳邻域视图。

**性能特征**: 这种查询模式的性能非常高。由于利用了DynamoDB的索引，两次`Query`操作的延迟都非常低，通常在个位数毫秒级别。这种性能的非对称性是本架构的一个重要特点：一跳查询非常快，而多跳查询的性能则取决于应用层的实现。

**单元测试**: 为确保查询逻辑的正确性，强烈建议为`GraphQueryFunction`编写全面的单元测试。可以使用`aws-sdk-client-mock`库来模拟DynamoDB的`QueryCommand`，从而在不实际调用AWS服务的情况下验证函数的行为。

## 4.3. 查询模式二：多跳遍历 (N-Hop Traversal)

更复杂的查询，如“找出距离‘AI’节点三步之内的所有节点”，需要实现多跳遍历逻辑。

**挑战**: DynamoDB本身不支持递归查询。因此，遍历逻辑必须在`GraphQueryFunction`这个应用层中实现。

### 实现策略：Lambda内的迭代遍历

1.  客户端向`GraphQueryFunction`发送请求，如`{ "operation": "traverse", "startNode": "A1B2C3", "depth": 3 }`。
2.  函数内部维护一个`visitedNodes`集合（用于防止循环）和一个`nodesToVisit`队列，初始时包含起始节点。
3.  函数进行一个循环，迭代次数由`depth`决定。在每次迭代中：
    a.  从`nodesToVisit`队列中取出一批节点。
    b.  对每个节点，并行执行4.2节中描述的一跳邻居查询（包括出边和入边）。
    c.  将新发现的、且未被访问过的邻居节点添加到`nodesToVisit`队列中，以备下一次迭代使用。
    d.  将本次迭代发现的节点和边聚合到最终结果中。
4.  循环结束后，返回整个遍历过程中发现的子图。

**高级替代方案：AWS Step Functions**: 对于可能需要非常深或长时间运行的遍历，上述单次Lambda调用可能会面临超时（最长15分钟）或内存限制。在这种情况下，可以设计一个AWS Step Functions状态机来编排遍历过程。每一步遍历由一次Lambda调用完成，并将下一批待访问的节点作为状态传递给下一次调用。这种方式更加健壮和可扩展，但实现复杂度也更高。

## 4.4. 使用PartiQL进行临时查询

**用途**: PartiQL是AWS提供的一种兼容SQL的查询语言，可用于查询DynamoDB中的数据。它为开发者提供了一个熟悉的接口，非常适合在开发和调试阶段进行一次性的数据探查。

**示例**: `SELECT * FROM "KnowledgeGraph" WHERE PK = 'NODE#A1B2C3'`

**核心限制**: 必须强调，PartiQL for DynamoDB不支持跨项目集合的JOIN操作，也无法执行图遍历。它本质上是一种针对单个项目或项目集合的查询语言，而不是图遍历引擎。因此，在本架构中，其用途仅限于简单的、基于主键的数据检索，不能用于实现核心的图查询业务逻辑。

## 4.5. 图查询中的分页处理

在图的上下文中，分页是一个复杂但必须处理的问题。如果一个节点拥有成千上万的邻居（例如，一个拥有10,000个连接的“超级节点”），那么一次一跳查询返回的数据量很可能会超过DynamoDB Query API 1MB的单次响应大小限制。

### 处理机制:

1.  当`Query`操作的结果集超过1MB时，DynamoDB的响应中会包含一个`LastEvaluatedKey`字段。这个字段包含了本次返回的最后一个项目的完整主键。
2.  `GraphQueryFunction`在收到带有`LastEvaluatedKey`的响应时，必须意识到结果并未完全返回。
3.  为了获取下一“页”的数据，函数需要发起一次新的`Query`请求，并在请求参数中包含`ExclusiveStartKey`，其值正是上一次响应中的`LastEvaluatedKey`。
4.  这个过程需要循环进行，直到某次`Query`响应中不再包含`LastEvaluatedKey`为止。

**API设计影响**: 这意味着`GraphQueryFunction`的API接口也需要支持分页。当客户端请求一个节点的邻居时，如果数据量过大，`GraphQueryFunction`的响应中应包含一个不透明的分页令牌（cursor），该令牌内部编码了`LastEvaluatedKey`的信息。客户端在下一次请求时需要回传这个令牌，以便函数能从上次中断的地方继续获取数据。这确保了即便是面对高度连接的节点，系统也能稳定地返回完整的数据。

---

# 第五部分：大型语言模型（LLM）的智能增强

本部分将探讨如何在本知识图谱之上构建一个智能交互层，将原始的结构化数据查询能力，提升为强大的自然语言问答和分析能力。

## 5.1. 图谱增强生成 (Graph-RAG) 范式

检索增强生成（Retrieval-Augmented Generation, RAG）是当前提升LLM能力的主流技术。本系统采用的是其更高级的变体——**Graph-RAG**。

### 标准RAG与Graph-RAG的对比

-   **标准RAG**: 其检索阶段通常从向量数据库中获取与用户查询语义相似的、独立的文本块（chunks）。这些文本块被拼接起来作为上下文提供给LLM。
-   **Graph-RAG**: 其检索阶段则从知识图谱中获取一个结构化的、相互连接的子图（subgraph）。这个子图不仅包含相关的实体（节点），更重要的是包含了它们之间明确的关系（边）。

### Graph-RAG的优势

-   **更丰富的上下文**: 明确的关系信息为LLM提供了远超“词袋模型”的上下文深度。LLM可以理解实体之间是如何关联的，从而进行更复杂的逻辑推理。
-   **减少幻觉**: 因为答案生成被严格限制在提供的结构化子图内，LLM“凭空捏造”信息的可能性被大大降低。
-   **支持复杂推理**: 对于需要多跳推理（multi-hop reasoning）的问题，如图谱能够清晰地展示推理路径，帮助LLM生成更准确、更具解释性的答案。近期的研究，如KnowTrace框架，进一步证明了结构化上下文对于激发LLM高级推理能力的关键作用。

## 5.2. 实现“自然语言到图遍历”的智能代理

我们设计一个名为`KnowledgeAgentFunction`的Lambda函数，作为整个智能问答流程的编排者。它将用户的自然语言问题转化为一系列对图谱的结构化查询，并最终生成自然语言答案。

### 第一步：查询意图解构 (LLM调用 #1)

-   **场景**: 用户提问：“关于Serverless的关键技术有哪些？这个领域的主要专家是谁？”
-   **流程**: `KnowledgeAgentFunction`接收到问题后，会构建一个Prompt。这个Prompt包含用户的原始问题，以及一份关于知识图谱的概要“模式”（Schema），例如告知LLM图中存在'Technology'和'Person'等节点类型，以及'RELATED_TO'和'EXPERT_ON'等关系类型。
-   **目标**: 该Prompt指示LLM将用户的自然语言问题，分解成一个结构化的查询计划（Query Plan），并以JSON格式返回。例如：

```json
{
  "startNode": "Serverless",
  "traversals": [
    {
      "relationship": "RELATED_TO",
      "targetType": "Technology"
    },
    {
      "relationship": "EXPERT_ON",
      "targetType": "Person"
    }
  ]
}
```

**原理**: 这一步利用了LLM强大的自然语言理解和结构化数据生成能力，将模糊的人类语言转换为精确的、机器可执行的指令。这种模式在先进的Text-to-Cypher系统中得到了广泛应用和验证。

### 第二步：程序化的图遍历执行

1.  `KnowledgeAgentFunction`接收到LLM返回的查询计划后，会解析该JSON。
2.  然后，它根据计划中的指令，调用`GraphQueryFunction`（在第四部分中定义）来执行实际的图遍历操作。例如，它会先请求以"Serverless"为起点的所有`RELATED_TO`关系，然后再请求所有`EXPERT_ON`关系。
3.  执行结果是一个包含所有相关节点和边的子图数据。

### 第三步：上下文增强与答案生成 (LLM调用 #2)

1.  `KnowledgeAgentFunction`将上一步获取的结构化子图数据，序列化为一种适合LLM处理的文本格式。
2.  接着，它构建第二个Prompt。这个Prompt包含用户的原始问题，以及被序列化为文本的子图数据作为上下文。
3.  **目标**: 该Prompt明确指示LLM，仅根据提供的上下文信息，综合、推理并生成一个流畅的自然语言答案。

## 5.3. 面向LLM的图数据提示工程

如何将一个图结构有效地表示为纯文本，是Graph-RAG成功的关键。

### 序列化格式比较

| 格式 | 示例 | 优点 | 缺点 | 最佳适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **JSON** | `{"nodes": [...], "edges": [...]}` | 结构化程度高，无歧义，LLM训练数据中包含大量JSON，理解能力强。 | 冗长（Token消耗高），LLM有时难以直接从嵌套结构中理解关系。 | 输出结果需要被下游程序再次解析的自动化系统。 |
| **简化三元组** | `(Serverless) -[uses]-> (Lambda)` <br> `(Lambda) -[is_a]-> (ComputeService)` | Token效率高，格式类似图查询语言，关系明确。 | 在通用训练数据中不常见，可能需要提供少量示例（few-shot）来引导模型。 | 需要进行复杂推理，实体间关系至关重要的任务。 |
| **Markdown列表** | `- Serverless`<br>`  - uses: Lambda`<br>`    - is_a: ComputeService` | 人类可读性好，适合表示层级结构，Token效率较高。 | 对于非树状图（如存在多父节点）可能产生歧义。 | 从层级结构的子图中进行摘要生成或报告撰写。 |

### 提示工程最佳实践:

-   **明确指令**: 在Prompt的开头清晰地陈述任务，例如“请根据以下知识图谱上下文，回答用户的问题”。
-   **使用分隔符**: 使用如`### CONTEXT ###`和`### QUESTION ###`这样的分隔符，将图谱上下文、用户问题和指令清晰地隔离开。
-   **提供示例 (Few-shot Prompting)**: 在Prompt中提供一两个完整的“问题-上下文-答案”示例，可以极大地帮助LLM理解期望的输出格式和推理风格。

## 5.4. 高级模式：迭代与反思式RAG (KnowTrace方法)

这是对上述两阶段LLM调用流程的进一步优化，代表了当前Graph-RAG领域的前沿思想，能够显著提升处理复杂、多跳问题的准确性。

**核心概念**: 该模式不再被动地接收一个预先检索好的大块上下文，而是让LLM主动地、迭代地驱动图的遍历过程。

### 工作流程:

1.  **启动**: LLM接收到初始的用户问题。
2.  **探索 (Explore)**: LLM分析问题，并决定第一个探索步骤。例如，它会生成指令：“从‘Serverless’节点开始，查找‘RELATED_TO’关系。”
3.  **查询与检索**: `KnowledgeAgentFunction`执行这个单步查询，从DynamoDB中获取一小组直接相关的节点和边。
4.  **完成与反思 (Complete & Reflect)**: 检索到的新知识被格式化后，返回给LLM。现在，LLM的上下文知识图谱被扩大了一点。它会“反思”这些新信息，并基于更新后的上下文，决定下一步的探索方向（例如，“现在从‘Lambda’节点开始，查找‘CREATED_BY’关系”）。
5.  **循环**: 系统重复步骤2至4，LLM像一个侦探一样，一步步地构建与问题相关的知识图谱，直到它判断当前掌握的信息足以完整、准确地回答最初的问题为止。

**优势**: 这种被称为“知识追踪”（Knowledge Tracing）的方法，通过只在每一步检索高度相关的信息，有效缓解了“上下文过载”的问题。它更紧密地模拟了人类专家的推理过程：不是一次性阅读所有资料，而是带着问题，有针对性地、循序渐进地查找和整合信息。这为解决深度复杂的多跳问题提供了最高的潜力。

---

# 第六部分：结论与展望

本报告详细设计了一个基于TypeScript和AWS Serverless生态的知识图谱系统。该系统以Whimsical脑图为输入源，通过创新的SVG解析技术实现高保真数据抽取，并巧妙地运用DynamoDB的邻接表模式实现了低成本、高可扩展的图数据存储。

## 核心架构总结

-   **数据管道**: 建立了一条从非结构化视觉信息到结构化图数据的自动化处理管道，其核心在于利用无头浏览器和SVG解析技术，最大限度地保留了原始脑图中的语义信息。
-   **存储与查询**: 通过在DynamoDB上实施邻接表和反向索引（GSI）模式，成功地用一个通用NoSQL数据库模拟了图数据库的核心功能，实现了在成本可控的前提下的高效单跳邻居查询。多跳遍历等复杂逻辑则被封装在专用的Lambda函数中，体现了Serverless架构下计算与存储分离的思想。
-   **智能交互**: 架构的顶层是一个基于Graph-RAG范式的智能代理。它利用大型语言模型（LLM）将用户的自然语言问题转化为对图谱的结构化查询计划，再将查询结果（结构化子图）作为上下文，生成精确、可靠的自然语言回答。

## 关键权衡与决策

本架构的核心是在成本效益与原生图功能之间做出的战略性权衡。选择DynamoDB而非Amazon Neptune，意味着接受了在应用层（Lambda）实现复杂图遍历逻辑的挑战，以换取更低的启动成本、更精细的按需付费模式以及与AWS Serverless生态更紧密的集成。对于许多初创项目、内部工具或对成本高度敏感的应用场景，这是一个明智且务实的选择。

## 未来展望与演进方向

-   **查询能力增强**: 随着图谱规模和查询复杂度的增长，可以考虑将`GraphQueryFunction`的遍历逻辑从单次Lambda调用迁移到由AWS Step Functions编排的分布式工作流，以支持更深、更耗时的图遍历任务。
-   **RAG策略演进**: 当前设计的两阶段LLM调用是实现智能交互的稳健起点。未来可以演进到更高级的迭代与反思式RAG模型（如KnowTrace范式），让LLM主动引导知识探索过程，以应对更复杂的多跳推理问题，进一步提升问答的准确性和深度。
-   **数据源扩展**: 当前架构以Whimsical为中心，但其模块化的设计使其易于扩展。可以开发新的解析器来支持其他数据源，如Markdown文档、项目管理工具（如Jira, Trello）的API数据，甚至是代码库，将更多类型的知识融入统一的图谱中。
-   **多模态知识图谱**: 随着多模态LLM的发展，未来的知识图谱可以不仅仅包含文本信息。可以扩展节点属性，存储图像、视频片段或音频文件的引用（例如，存储在S3中），并利用多模态LLM进行跨模态的查询与分析。

综上所述，本报告提出的架构不仅为解决当前用户需求提供了一套完整、可行的技术方案，也为系统未来的发展和演进奠定了坚实的基础。它充分展示了如何结合TypeScript的工程优势与AWS Server-less的架构优势，构建一个现代化、智能化且经济高效的知识图谱应用。
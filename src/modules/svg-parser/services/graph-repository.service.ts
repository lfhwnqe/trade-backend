import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { MindMapData } from '../types/mindmap.types';
import { simpleTokenize } from '../utils/tokenizer';

@Injectable()
export class GraphRepositoryService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName = process.env.DYNAMODB_TABLE_NAME || 'GraphData';
  private readonly gsi1Name = 'targetNode-PK-index'; // GSI for finding parent nodes

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION,
    });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  // =================================================================
  // == SEARCH METHOD (CORE OF INVERTED INDEX)
  // =================================================================

  /**
   * Searches for nodes containing a specific keyword using the inverted index.
   * @param keyword The keyword to search for.
   * @returns A list of { graphId, nodeId } references.
   */
  async searchNodesByKeyword(
    keyword: string,
  ): Promise<{ graphId: string; nodeId: string }[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `WORD#${keyword.toLowerCase()}`,
      },
    });

    const { Items } = await this.docClient.send(command);

    return Items.map((item) => {
      const [graphId, nodeSK] = item.SK.split('|');
      return { graphId, nodeId: nodeSK.replace('NODE#', '') };
    });
  }

  // =================================================================
  // == CRUD OPERATIONS (MODIFIED FOR INVERTED INDEX)
  // =================================================================

  /**
   * C: Creates a full graph structure, including the inverted index for node text.
   */
  async createGraph(graphId: string, mindMapData: MindMapData): Promise<void> {
    const { nodes, links, metadata } = mindMapData;
    let writeRequests = [];

    // 1. Metadata Item
    writeRequests.push({
      PutRequest: {
        Item: {
          PK: graphId,
          SK: 'METADATA',
          ...metadata,
          nodeCount: nodes.length,
          edgeCount: links.length,
          createdAt: new Date().toISOString(),
        },
      },
    });

    // 2. Node and Index Items
    for (const node of nodes) {
      // Add the node itself
      writeRequests.push({
        PutRequest: { Item: { PK: graphId, SK: `NODE#${node.id}`, ...node } },
      });

      // Add inverted index entries for the node's text
      const keywords = simpleTokenize(node.text);
      for (const keyword of keywords) {
        writeRequests.push({
          PutRequest: {
            Item: {
              PK: `WORD#${keyword}`,
              SK: `${graphId}|NODE#${node.id}`, // SK stores the location of the node
            },
          },
        });
      }
    }

    // 3. Edge Items
    links.forEach((link) => {
      writeRequests.push({
        PutRequest: {
          Item: {
            PK: graphId,
            SK: `EDGE#${link.source}#${link.target}`,
            sourceNode: `NODE#${link.source}`,
            targetNode: `NODE#${link.target}`,
          },
        },
      });
    });

    // Batch write all items
    for (let i = 0; i < writeRequests.length; i += 25) {
      const chunk = writeRequests.slice(i, i + 25);
      await this.docClient.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: chunk } }),
      );
    }
  }

  /**
   * U: Updates a node's text, ensuring the inverted index is updated atomically.
   */
  async updateNodeText(
    graphId: string,
    nodeId: string,
    newText: string,
  ): Promise<any> {
    const nodeSK = `NODE#${nodeId}`;

    // 1. Get the current node to find its old text
    const { Item: currentNode } = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: graphId, SK: nodeSK },
      }),
    );
    if (!currentNode) throw new Error('Node not found');

    const oldKeywords = simpleTokenize(currentNode.text);
    const newKeywords = simpleTokenize(newText);

    const keywordsToDelete = [...oldKeywords].filter((k) => !newKeywords.has(k));
    const keywordsToAdd = [...newKeywords].filter(
      (k) => !oldKeywords.has(k),
    );

    // 2. Build a transaction to update everything at once
    const transactionItems = [];

    // Update the node itself
    transactionItems.push({
      Update: {
        TableName: this.tableName,
        Key: { PK: graphId, SK: nodeSK },
        UpdateExpression: 'set #text = :text, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#text': 'text' },
        ExpressionAttributeValues: {
          ':text': newText,
          ':updatedAt': new Date().toISOString(),
        },
      },
    });

    // Delete old keyword indexes
    for (const keyword of keywordsToDelete) {
      transactionItems.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: `WORD#${keyword}`, SK: `${graphId}|${nodeSK}` },
        },
      });
    }

    // Add new keyword indexes
    for (const keyword of keywordsToAdd) {
      transactionItems.push({
        Put: {
          TableName: this.tableName,
          Item: { PK: `WORD#${keyword}`, SK: `${graphId}|${nodeSK}` },
        },
      });
    }

    // 3. Execute the transaction
    // Note: TransactWriteCommand has a limit of 100 items
    if (transactionItems.length > 100) {
      // Handle this case if necessary, e.g., by failing or splitting into multiple transactions
      throw new Error('Too many index changes to update atomically.');
    }
    await this.docClient.send(
      new TransactWriteCommand({ TransactItems: transactionItems }),
    );

    return this.getNode(graphId, nodeSK);
  }

  /**
   * D: Deletes an entire graph, including all its inverted index entries.
   */
  async deleteGraph(graphId: string): Promise<void> {
    const items = await this.getGraph(graphId);
    if (!items || items.length === 0) return;

    const deleteRequests = [];
    for (const item of items) {
      // Add the item itself to be deleted
      deleteRequests.push({
        DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
      });

      // If it's a node, also delete its index entries
      if (item.SK.startsWith('NODE#') && item.text) {
        const keywords = simpleTokenize(item.text);
        for (const keyword of keywords) {
          deleteRequests.push({
            DeleteRequest: {
              Key: { PK: `WORD#${keyword}`, SK: `${graphId}|${item.SK}` },
            },
          });
        }
      }
    }

    for (let i = 0; i < deleteRequests.length; i += 25) {
      const chunk = deleteRequests.slice(i, i + 25);
      await this.docClient.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: chunk } }),
      );
    }
  }

  // =================================================================
  // == GRAPH TRAVERSAL (UNCHANGED FROM PREVIOUS)
  // =================================================================

  async getGraph(graphId: string): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': graphId },
    });
    const { Items } = await this.docClient.send(command);
    return Items;
  }

  async getSubgraphForNode(
    graphId: string,
    startNodeId: string,
  ): Promise<any[]> {
    const startNodeSK = `NODE#${startNodeId}`;
    const subgraphItems = new Map<string, any>();

    const startNode = await this.getNode(graphId, startNodeSK);
    if (startNode) subgraphItems.set(startNode.SK, startNode);
    else return [];

    const parentEdges = await this.getIncomingEdges(graphId, startNodeSK);
    for (const edge of parentEdges) {
      subgraphItems.set(edge.SK, edge);
      const parentNode = await this.getNode(graphId, edge.sourceNode);
      if (parentNode) subgraphItems.set(parentNode.SK, parentNode);
    }

    const childEdges = await this.getOutgoingEdges(graphId, startNodeId);
    for (const edge of childEdges) {
      subgraphItems.set(edge.SK, edge);
      const childNode = await this.getNode(graphId, edge.targetNode);
      if (childNode) subgraphItems.set(childNode.SK, childNode);
    }

    return Array.from(subgraphItems.values());
  }

  private async getNode(graphId: string, nodeSK: string): Promise<any> {
    const { Item } = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: graphId, SK: nodeSK },
      }),
    );
    return Item;
  }

  private async getIncomingEdges(
    graphId: string,
    targetNodeSK: string,
  ): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: this.gsi1Name,
      KeyConditionExpression: 'targetNode = :tn and PK = :pk',
      ExpressionAttributeValues: { ':tn': targetNodeSK, ':pk': graphId },
    });
    const { Items } = await this.docClient.send(command);
    return Items;
  }

  private async getOutgoingEdges(
    graphId: string,
    sourceNodeId: string,
  ): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk and begins_with(SK, :edgePrefix)',
      ExpressionAttributeValues: {
        ':pk': graphId,
        ':edgePrefix': `EDGE#${sourceNodeId}#`,
      },
    });
    const { Items } = await this.docClient.send(command);
    return Items;
  }
}

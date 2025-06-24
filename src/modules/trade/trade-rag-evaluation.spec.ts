import { Test, TestingModule } from '@nestjs/testing';
import { TradeService } from './trade.service';
import { TradeHistoryRAGService } from '../rag/trade-history-rag.service';
import { ConfigService } from '../common/config.service';
import { Trade } from './entities/trade.entity';
import {
  TradeType,
  TradeStatus,
  TradeResult,
  EntryDirection,
  MarketStructure,
  TradeGrade,
} from './dto/create-trade.dto';

describe('TradeService - RAG Evaluation Logic', () => {
  let service: TradeService;
  let mockRAGService: jest.Mocked<TradeHistoryRAGService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-value'),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'TRANSACTIONS_TABLE_NAME') return 'test-table';
        if (key === 'AWS_REGION') return 'us-east-1';
        return 'test-value';
      }),
    };

    mockRAGService = {
      addTradeToHistory: jest.fn(),
      removeTradeFromHistory: jest.fn(),
      searchSimilarTrades: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        {
          provide: TradeHistoryRAGService,
          useValue: mockRAGService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);
  });

  // 创建基础交易数据
  const createBaseTrade = (overrides: Partial<Trade> = {}): Trade => ({
    transactionId: 'test-trade-id',
    userId: 'test-user-id',
    tradeType: TradeType.SIMULATION,
    tradeSubject: 'BTC',
    status: TradeStatus.EXITED,
    analysisTime: '2024-01-01T00:00:00Z',
    marketStructure: MarketStructure.BALANCED,
    marketStructureAnalysis: '市场处于震荡状态，价格在关键支撑阻力位之间波动',
    entryPrice: 50000,
    entryDirection: EntryDirection.LONG,
    exitPrice: 51000,
    tradeResult: TradeResult.PROFIT,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    volumeProfileImages: [],
    poc: 50500,
    val: 49500,
    vah: 51500,
    entryPlanA: {
      entryReason: '价格回调至支撑位',
      entrySignal: '成交量减少',
      exitSignal: '价格突破阻力位',
    },
    ...overrides,
  });

  describe('evaluateTradeValueForRAG', () => {
    it('应该拒绝数据不完整的交易', async () => {
      const incompleteTrade = createBaseTrade({
        marketStructureAnalysis: '', // 缺少关键分析
      });

      // 使用反射访问私有方法进行测试
      const result = (service as any).evaluateTradeValueForRAG(incompleteTrade);

      expect(result.shouldAdd).toBe(false);
      expect(result.reason).toContain('交易数据不完整');
    });

    it('应该接受纯行情分析记录', async () => {
      const analysisOnlyTrade = createBaseTrade({
        status: TradeStatus.ANALYZED, // 仅分析，无实际交易
        entryPrice: undefined, // 没有入场价格
        exitPrice: undefined, // 没有离场价格
        entryDirection: undefined, // 没有入场方向
        tradeResult: undefined, // 没有交易结果
        expectedPathAnalysis:
          '预期市场将在当前支撑位企稳后向上突破，关键阻力位在前高附近',
        lessonsLearned:
          '通过这次分析学到了在震荡市场中识别关键支撑阻力位的重要性',
      });

      const result = (service as any).evaluateTradeValueForRAG(
        analysisOnlyTrade,
      );

      expect(result.shouldAdd).toBe(true);
      expect(result.reason).toContain('纯行情分析');
    });

    it('应该给进行中的交易较低评分', async () => {
      const ongoingTrade = createBaseTrade({
        status: TradeStatus.ENTERED, // 交易进行中
        exitPrice: undefined, // 没有离场价格
        tradeResult: undefined, // 没有交易结果
      });

      const completedTrade = createBaseTrade({
        status: TradeStatus.EXITED, // 交易已完结
      });

      const ongoingResult = (service as any).evaluateTradeValueForRAG(
        ongoingTrade,
      );
      const completedResult = (service as any).evaluateTradeValueForRAG(
        completedTrade,
      );

      // 进行中的交易评分应该低于已完结的交易
      expect(ongoingResult.score).toBeLessThan(completedResult.score);
      // 由于都没达到阈值，检查评分差异即可
      expect(ongoingResult.shouldAdd).toBe(false);
      expect(completedResult.shouldAdd).toBe(false);
    });

    it('应该接受高价值的完整交易记录', async () => {
      const highValueTrade = createBaseTrade({
        grade: TradeGrade.HIGH, // 高重要性
        tradeType: TradeType.REAL, // 真实交易
        lessonsLearned:
          '这次交易让我学到了在震荡市场中耐心等待突破的重要性，同时也认识到了风险管理的关键作用', // 详细经验总结
        mentalityNotes: '入场后感到紧张，但坚持了交易计划', // 心态记录
        actualPathAnalysis:
          '价格如预期在支撑位获得支撑后反弹，但反弹力度超出预期', // 实际路径分析
        volumeProfileImages: [{ key: 'img1', url: 'url1' }],
        expectedPathImages: [{ key: 'img2', url: 'url2' }],
        actualPathImages: [{ key: 'img3', url: 'url3' }],
        analysisImages: [
          { key: 'img4', url: 'url4' },
          { key: 'img5', url: 'url5' },
        ],
      });

      const result = (service as any).evaluateTradeValueForRAG(highValueTrade);

      expect(result.shouldAdd).toBe(true);
      expect(result.score).toBeGreaterThan(45); // 新阈值
      expect(result.reason).toContain('综合评分');
    });

    it('应该给亏损交易更高的学习价值评分', async () => {
      const lossTrade = createBaseTrade({
        tradeResult: TradeResult.LOSS,
        exitPrice: 49000, // 亏损
        lessonsLearned: '这次亏损让我认识到止损的重要性',
      });

      const profitTrade = createBaseTrade({
        tradeResult: TradeResult.PROFIT,
        lessonsLearned: '这次盈利验证了我的分析方法',
      });

      const lossResult = (service as any).evaluateTradeValueForRAG(lossTrade);
      const profitResult = (service as any).evaluateTradeValueForRAG(
        profitTrade,
      );

      // 亏损交易应该获得更高的多样性评分
      expect(lossResult.score).toBeGreaterThan(profitResult.score);
    });

    it('应该正确评估分析质量', async () => {
      const highQualityTrade = createBaseTrade({
        marketStructureAnalysis:
          '市场目前处于上升趋势中的回调阶段，价格在关键斐波那契回撤位获得支撑，成交量在回调过程中逐步萎缩，显示抛压减轻', // 详细分析
        expectedPathAnalysis: '预期价格将在当前支撑位企稳后重新向上突破前高',
        entryPlanB: {
          entryReason: '备选方案：如果跌破支撑位则反手做空',
          entrySignal: '跌破支撑位且成交量放大',
          exitSignal: '到达下一个支撑位',
        },
        volumeProfileImages: [
          { key: 'img1', url: 'url1' },
          { key: 'img2', url: 'url2' },
        ],
        expectedPathImages: [{ key: 'img3', url: 'url3' }],
        actualPathImages: [{ key: 'img4', url: 'url4' }],
        analysisImages: [
          { key: 'img5', url: 'url5' },
          { key: 'img6', url: 'url6' },
        ],
      });

      const basicTrade = createBaseTrade({
        marketStructureAnalysis: '震荡市场', // 简单分析
      });

      const highQualityResult = (service as any).evaluateTradeValueForRAG(
        highQualityTrade,
      );
      const basicResult = (service as any).evaluateTradeValueForRAG(basicTrade);

      expect(highQualityResult.score).toBeGreaterThan(basicResult.score);
    });
  });

  describe('checkAndAddToRAGHistory', () => {
    it('应该为高价值交易调用RAG服务', async () => {
      const highValueTrade = createBaseTrade({
        grade: TradeGrade.HIGH,
        tradeType: TradeType.REAL,
        lessonsLearned: '详细的经验总结内容',
      });

      await (service as any).checkAndAddToRAGHistory(highValueTrade);

      expect(mockRAGService.addTradeToHistory).toHaveBeenCalledWith(
        highValueTrade,
      );
    });

    it('应该跳过低价值交易', async () => {
      const lowValueTrade = createBaseTrade({
        marketStructureAnalysis: '', // 数据不完整
      });

      await (service as any).checkAndAddToRAGHistory(lowValueTrade);

      expect(mockRAGService.addTradeToHistory).not.toHaveBeenCalled();
    });
  });
});

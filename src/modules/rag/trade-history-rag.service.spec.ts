import { Test, TestingModule } from '@nestjs/testing';
import { TradeHistoryRAGService } from './trade-history-rag.service';
import { ConfigService } from '../common/config.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeType, TradeStatus } from '../trade/dto/create-trade.dto';

// Mock Upstash Vector
jest.mock('@upstash/vector', () => ({
  Index: jest.fn().mockImplementation(() => ({
    upsert: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock AI SDK
jest.mock('ai', () => ({
  embed: jest.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0.1), // Mock embedding vector
  }),
}));

describe('TradeHistoryRAGService', () => {
  let service: TradeHistoryRAGService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeHistoryRAGService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'UPSTASH_VECTOR_REST_URL':
                  return 'https://test-vector.upstash.io';
                case 'UPSTASH_VECTOR_REST_TOKEN':
                  return 'test-token';
                default:
                  return 'test-value';
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TradeHistoryRAGService>(TradeHistoryRAGService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTradeToHistory', () => {
    it('should add trade to history successfully', async () => {
      const mockTrade: Trade = {
        transactionId: 'test-trade-id',
        userId: 'test-user-id',
        tradeType: TradeType.SIMULATION,
        tradeSubject: 'BTC',
        status: TradeStatus.EXITED,
        analysisTime: '2024-01-01T00:00:00Z',
        lessonsLearned: 'Test lessons learned',
        analysisExpired: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      await expect(service.addTradeToHistory(mockTrade)).resolves.not.toThrow();
    });
  });

  describe('removeTradeFromHistory', () => {
    it('should remove trade from history successfully', async () => {
      const tradeId = 'test-trade-id';

      await expect(
        service.removeTradeFromHistory(tradeId),
      ).resolves.not.toThrow();
    });
  });

  describe('searchSimilarTrades', () => {
    it('should search similar trades successfully', async () => {
      const userId = 'test-user-id';
      const query = 'BTC trading strategy';

      const result = await service.searchSimilarTrades(userId, query, 5);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

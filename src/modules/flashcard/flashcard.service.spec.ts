const mockDb = {
  put: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  batchGet: jest.fn(),
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: jest.fn(() => mockDb),
  },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

import { v4 as uuidv4 } from 'uuid';
import { FlashcardService } from './flashcard.service';
import { ResourceNotFoundException } from '../../base/exceptions/custom.exceptions';

describe('FlashcardService', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        AWS_REGION: 'ap-east-1',
        FLASHCARDS_TABLE_NAME: 'flashcards-test',
        IMAGE_BUCKET_NAME: 'images-test',
      };
      return map[key];
    }),
    get: jest.fn((key: string) => {
      if (key === 'CLOUDFRONT_DOMAIN_NAME') {
        return 'cdn.example.com';
      }
      return undefined;
    }),
  } as any;

  const makeService = () => new FlashcardService(configService);

  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('uuid-1');
  });

  it('should create card with trimmed optional fields and normalized action', async () => {
    const service = makeService();
    mockDb.put.mockResolvedValue({});

    const result = await service.createCard('user-1', {
      questionImageUrl: 'question-url',
      answerImageUrl: 'answer-url',
      direction: 'SHORT',
      behaviorType: 'ZONE_REJECTION',
      invalidationType: 'REJECTION_EXTREME_BROKEN',
      earlyExitTag: true,
      earlyExitReason: '  no expansion after trigger  ',
      marketTimeInfo: '  London Open  ',
      symbolPairInfo: '  BTCUSDT  ',
      notes: '  wait for rejection  ',
    } as any);

    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'flashcards-test',
        Item: expect.objectContaining({
          userId: 'user-1',
          cardId: 'uuid-1',
          expectedAction: 'SHORT',
          direction: 'SHORT',
          earlyExitTag: true,
          earlyExitReason: 'no expansion after trigger',
          marketTimeInfo: 'London Open',
          symbolPairInfo: 'BTCUSDT',
          notes: 'wait for rejection',
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data.expectedAction).toBe('SHORT');
    expect(result.data.direction).toBe('SHORT');
    expect(result.data.earlyExitTag).toBe(true);
    expect(result.data.earlyExitReason).toBe('no expansion after trigger');
  });

  it('should submit wrong attempt, persist wrong-book/favorite, and update running stats', async () => {
    const service = makeService();

    mockDb.get
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          cardId: 'session#session-1',
          entityType: 'SESSION',
          sessionId: 'session-1',
          source: 'ALL',
          total: 2,
          answered: 0,
          correct: 0,
          wrong: 0,
          score: 0,
          status: 'IN_PROGRESS',
          cardIds: ['card-1', 'card-2'],
          startedAt: '2026-03-09T10:00:00.000Z',
          createdAt: '2026-03-09T10:00:00.000Z',
          updatedAt: '2026-03-09T10:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'question-url',
          answerImageUrl: 'answer-url',
          expectedAction: 'LONG',
          behaviorType: 'ZONE_REJECTION',
          invalidationType: 'REJECTION_EXTREME_BROKEN',
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T09:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({});

    mockDb.put.mockResolvedValue({});
    mockDb.delete.mockResolvedValue({});
    mockDb.update
      .mockResolvedValueOnce({
        Attributes: {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'question-url',
          answerImageUrl: 'answer-url',
          expectedAction: 'LONG',
          direction: 'LONG',
          notes: 'fresh note',
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T10:10:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Attributes: {
          userId: 'user-1',
          cardId: 'session#session-1',
          entityType: 'SESSION',
          sessionId: 'session-1',
          source: 'ALL',
          total: 2,
          answered: 1,
          correct: 0,
          wrong: 1,
          score: 0,
          status: 'IN_PROGRESS',
          cardIds: ['card-1', 'card-2'],
          startedAt: '2026-03-09T10:00:00.000Z',
          createdAt: '2026-03-09T10:00:00.000Z',
          updatedAt: '2026-03-09T10:10:00.000Z',
        },
      });

    const result = await service.submitAttempt('user-1', 'session-1', {
      cardId: 'card-1',
      userAction: 'SHORT',
      isFavorite: true,
      note: '  fresh note  ',
    } as any);

    expect(result).toEqual({
      success: true,
      data: {
        isCorrect: false,
        expectedAction: 'LONG',
        runningStats: {
          total: 2,
          answered: 1,
          correct: 0,
          wrong: 1,
          accuracy: 0,
          score: 0,
          status: 'IN_PROGRESS',
        },
      },
    });

    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          cardId: 'favorite#card-1',
          entityType: 'FAVORITE',
          targetCardId: 'card-1',
        }),
      }),
    );
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          cardId: 'wrong#card-1',
          entityType: 'WRONG_BOOK',
          targetCardId: 'card-1',
          lastSessionId: 'session-1',
        }),
      }),
    );
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          cardId: 'attempt#session-1#card-1',
          entityType: 'ATTEMPT',
          userAction: 'SHORT',
          expectedAction: 'LONG',
          isCorrect: false,
          isFavorite: true,
          noteSnapshot: 'fresh note',
        }),
      }),
    );
  });

  it('should reject attempt when card is not part of session', async () => {
    const service = makeService();
    mockDb.get.mockResolvedValue({
      Item: {
        userId: 'user-1',
        cardId: 'session#session-1',
        entityType: 'SESSION',
        sessionId: 'session-1',
        source: 'ALL',
        total: 1,
        answered: 0,
        correct: 0,
        wrong: 0,
        score: 0,
        status: 'IN_PROGRESS',
        cardIds: ['card-2'],
        startedAt: '2026-03-09T10:00:00.000Z',
        createdAt: '2026-03-09T10:00:00.000Z',
        updatedAt: '2026-03-09T10:00:00.000Z',
      },
    });

    await expect(
      service.submitAttempt('user-1', 'session-1', {
        cardId: 'card-1',
        userAction: 'LONG',
      } as any),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('should summarize today new cards in Asia/Shanghai timezone', async () => {
    const service = makeService();

    mockDb.query.mockResolvedValueOnce({
      Items: [
        {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'q1',
          answerImageUrl: 'a1',
          expectedAction: 'LONG',
          createdAt: '2026-03-09T00:30:00.000Z',
          updatedAt: '2026-03-09T00:30:00.000Z',
        },
        {
          userId: 'user-1',
          cardId: 'card-2',
          entityType: 'CARD',
          questionImageUrl: 'q2',
          answerImageUrl: 'a2',
          expectedAction: 'SHORT',
          createdAt: '2026-03-08T15:30:00.000Z',
          updatedAt: '2026-03-08T15:30:00.000Z',
        },
      ],
    });

    jest.useFakeTimers().setSystemTime(new Date('2026-03-09T14:00:00.000Z'));

    const result = await service.getTodaySummary('user-1');

    expect(result).toEqual({
      success: true,
      data: {
        date: '2026-03-09',
        timezone: 'Asia/Shanghai',
        hasNewCardsToday: true,
        newCardsCount: 1,
        latestCreatedAt: '2026-03-09T00:30:00.000Z',
      },
    });

    jest.useRealTimers();
  });

  it('should build today collection summary with distributions and focused state', async () => {
    const service = makeService();

    mockDb.query.mockResolvedValueOnce({
      Items: [
        {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'q1',
          answerImageUrl: 'a1',
          expectedAction: 'LONG',
          behaviorType: 'ZONE_FAKE_BREAK',
          marketTimeInfo: 'London Open',
          symbolPairInfo: 'BTCUSDT',
          createdAt: '2026-03-10T01:00:00.000Z',
          updatedAt: '2026-03-10T01:00:00.000Z',
        },
        {
          userId: 'user-1',
          cardId: 'card-2',
          entityType: 'CARD',
          questionImageUrl: 'q2',
          answerImageUrl: 'a2',
          expectedAction: 'SHORT',
          behaviorType: 'ZONE_FAKE_BREAK',
          marketTimeInfo: 'London Open',
          symbolPairInfo: 'BTCUSDT',
          createdAt: '2026-03-10T02:00:00.000Z',
          updatedAt: '2026-03-10T02:00:00.000Z',
        },
        {
          userId: 'user-1',
          cardId: 'card-3',
          entityType: 'CARD',
          questionImageUrl: 'q3',
          answerImageUrl: 'a3',
          expectedAction: 'SHORT',
          behaviorType: 'BREAK_RETEST',
          marketTimeInfo: 'New York Open',
          symbolPairInfo: 'ETHUSDT',
          createdAt: '2026-03-10T03:30:00.000Z',
          updatedAt: '2026-03-10T03:30:00.000Z',
        },
      ],
    });

    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T04:00:00.000Z'));

    const result = await service.getTodayCollectionSummary('user-1');

    expect(result).toEqual({
      success: true,
      data: {
        date: '2026-03-10',
        timezone: 'Asia/Shanghai',
        hasNewCardsToday: true,
        newCardsCount: 3,
        firstCreatedAt: '2026-03-10T01:00:00.000Z',
        latestCreatedAt: '2026-03-10T03:30:00.000Z',
        minutesSinceLastCreated: 30,
        behaviorTypeDistribution: [
          { value: 'ZONE_FAKE_BREAK', count: 2 },
          { value: 'BREAK_RETEST', count: 1 },
        ],
        symbolPairDistribution: [
          { value: 'BTCUSDT', count: 2 },
          { value: 'ETHUSDT', count: 1 },
        ],
        marketTimeDistribution: [
          { value: 'London Open', count: 2 },
          { value: 'New York Open', count: 1 },
        ],
        collectionState: 'FOCUSED_COLLECTION',
      },
    });

    jest.useRealTimers();
  });

  it('should return real totalCount for flashcard list pagination', async () => {
    const service = makeService();

    mockDb.query.mockResolvedValueOnce({
      Items: [
        ...Array.from({ length: 21 }, (_, index) => ({
          userId: 'user-1',
          cardId: `card-${index + 1}`,
          entityType: 'CARD',
          questionImageUrl: `q${index + 1}`,
          answerImageUrl: `a${index + 1}`,
          expectedAction: 'LONG',
          createdAt: `2026-03-10T${String(index).padStart(2, '0')}:00:00.000Z`,
          updatedAt: `2026-03-10T${String(index).padStart(2, '0')}:00:00.000Z`,
        })),
      ],
    });

    const result = await service.listCards('user-1', { pageSize: 20 } as any);

    expect(result).toEqual({
      success: true,
      data: {
        items: expect.any(Array),
        totalCount: 21,
        nextCursor: expect.any(String),
      },
    });
    expect(result.data.items).toHaveLength(20);
  });

  it('should aggregate analytics from completed sessions and labeled attempts', async () => {
    const service = makeService();

    mockDb.query
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-1',
            cardId: 'session#s3',
            entityType: 'SESSION',
            sessionId: 's3',
            source: 'ALL',
            total: 2,
            answered: 2,
            correct: 2,
            wrong: 0,
            score: 100,
            status: 'COMPLETED',
            cardIds: ['card-1', 'card-2'],
            startedAt: '2026-03-09T10:00:00.000Z',
            endedAt: '2026-03-09T10:05:00.000Z',
            createdAt: '2026-03-09T10:00:00.000Z',
            updatedAt: '2026-03-09T10:05:00.000Z',
          },
          {
            userId: 'user-1',
            cardId: 'session#s2',
            entityType: 'SESSION',
            sessionId: 's2',
            source: 'ALL',
            total: 2,
            answered: 2,
            correct: 1,
            wrong: 1,
            score: 50,
            status: 'COMPLETED',
            cardIds: ['card-2', 'card-3'],
            startedAt: '2026-03-08T10:00:00.000Z',
            endedAt: '2026-03-08T10:05:00.000Z',
            createdAt: '2026-03-08T10:00:00.000Z',
            updatedAt: '2026-03-08T10:05:00.000Z',
          },
          {
            userId: 'user-1',
            cardId: 'session#s1',
            entityType: 'SESSION',
            sessionId: 's1',
            source: 'ALL',
            total: 1,
            answered: 1,
            correct: 0,
            wrong: 1,
            score: 0,
            status: 'IN_PROGRESS',
            cardIds: ['card-4'],
            startedAt: '2026-03-07T10:00:00.000Z',
            createdAt: '2026-03-07T10:00:00.000Z',
            updatedAt: '2026-03-07T10:01:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-1',
            cardId: 'attempt#s3#card-1',
            entityType: 'ATTEMPT',
            sessionId: 's3',
            targetCardId: 'card-1',
            isCorrect: true,
          },
          {
            userId: 'user-1',
            cardId: 'attempt#s3#card-2',
            entityType: 'ATTEMPT',
            sessionId: 's3',
            targetCardId: 'card-2',
            isCorrect: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-1',
            cardId: 'attempt#s2#card-2',
            entityType: 'ATTEMPT',
            sessionId: 's2',
            targetCardId: 'card-2',
            isCorrect: true,
          },
          {
            userId: 'user-1',
            cardId: 'attempt#s2#card-3',
            entityType: 'ATTEMPT',
            sessionId: 's2',
            targetCardId: 'card-3',
            isCorrect: false,
          },
        ],
      });

    mockDb.batchGet.mockResolvedValue({
      Responses: {
        'flashcards-test': [
          {
            userId: 'user-1',
            cardId: 'card-1',
            entityType: 'CARD',
            questionImageUrl: 'q1',
            answerImageUrl: 'a1',
            expectedAction: 'LONG',
            behaviorType: 'ZONE_REJECTION',
            invalidationType: 'REJECTION_EXTREME_BROKEN',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          {
            userId: 'user-1',
            cardId: 'card-2',
            entityType: 'CARD',
            questionImageUrl: 'q2',
            answerImageUrl: 'a2',
            expectedAction: 'SHORT',
            behaviorType: 'ZONE_REJECTION',
            invalidationType: 'BREAKOUT_BACK_IN_ZONE',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          {
            userId: 'user-1',
            cardId: 'card-3',
            entityType: 'CARD',
            questionImageUrl: 'q3',
            answerImageUrl: 'a3',
            expectedAction: 'NO_TRADE',
            invalidationType: 'BREAKOUT_BACK_IN_ZONE',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    });

    const result = await service.getDrillAnalytics('user-1', {
      recentWindow: 30,
    } as any);

    expect(result.success).toBe(true);
    expect(result.data.summary).toEqual({
      totalCompletedSessions: 2,
      averageScore: 75,
      bestScore: 100,
      recentScore: 100,
      recentAccuracy: 1,
    });
    expect(result.data.windows.recent7).toEqual({
      sampleSize: 2,
      averageScore: 75,
      bestScore: 100,
      lowestScore: 50,
      deltaFromPrevious: null,
    });
    expect(result.data.weaknesses.behaviorTypes[0]).toEqual({
      key: 'ZONE_REJECTION',
      total: 3,
      correct: 2,
      wrong: 1,
      accuracy: 2 / 3,
      wrongRate: 1 / 3,
    });
    expect(result.data.weaknesses.invalidationTypes[0]).toEqual({
      key: 'BREAKOUT_BACK_IN_ZONE',
      total: 3,
      correct: 1,
      wrong: 2,
      accuracy: 1 / 3,
      wrongRate: 2 / 3,
    });
    expect(result.data.weaknesses.unlabeledBehaviorAttemptCount).toBe(1);
    expect(result.data.trend.points).toHaveLength(2);
    expect(result.data.trend.points[0].sessionId).toBe('s2');
    expect(result.data.trend.points[1].sessionId).toBe('s3');
  });
});

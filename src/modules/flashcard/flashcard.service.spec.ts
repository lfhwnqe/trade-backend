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
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T09:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({});

    mockDb.put.mockResolvedValue({});
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

    expect(result.success).toBe(true);
    expect(result.data.isCorrect).toBe(false);
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({ Item: expect.objectContaining({ cardId: 'favorite#card-1' }) }),
    );
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({ Item: expect.objectContaining({ cardId: 'wrong#card-1' }) }),
    );
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({ Item: expect.objectContaining({ cardId: 'attempt#session-1#card-1' }) }),
    );
  });

  it('should submit simulation attempt and aggregate card metrics', async () => {
    const service = makeService();
    (uuidv4 as jest.Mock).mockReturnValueOnce('attempt-uuid');

    mockDb.get
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-1',
          cardId: 'simulation-session#sim-1',
          entityType: 'SIMULATION_SESSION',
          simulationSessionId: 'sim-1',
          source: 'ALL',
          count: 5,
          totalCards: 5,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
          status: 'IN_PROGRESS',
          cardIds: ['card-1'],
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
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T09:00:00.000Z',
          qualityScoreAvg: 5,
          qualityScoreCount: 1,
          simulationAttemptCount: 1,
          simulationAvgRr: 2,
          simulationSuccessCount: 1,
          simulationFailureCount: 0,
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
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T09:00:00.000Z',
          simulationAttemptCount: 1,
          simulationAvgRr: 2,
        },
      });

    mockDb.put.mockResolvedValue({});
    mockDb.update
      .mockResolvedValueOnce({
        Attributes: {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'question-url',
          answerImageUrl: 'answer-url',
          expectedAction: 'LONG',
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T10:10:00.000Z',
          simulationAttemptCount: 2,
          simulationAvgRr: 2,
          lastSimulationAt: '2026-03-09T10:10:00.000Z',
        },
      });

    const result = await service.createSimulationAttempt('user-1', 'sim-1', {
      cardId: 'card-1',
      revealProgress: 0.43,
      entryLineYPercent: 0.4,
      stopLossLineYPercent: 0.5,
      takeProfitLineYPercent: 0.2,
      rrValue: 2,
      entryDirection: 'LONG',
      entryReason: 'entry',
    } as any);

    expect(result.success).toBe(true);
    expect(result.data.cardMetrics.simulationAttemptCount).toBe(2);
    expect(mockDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          cardId: expect.stringContaining('simulation-attempt#sim-1#'),
          entityType: 'SIMULATION_ATTEMPT',
          revealProgress: 0.43,
          status: 'ENTRY_SAVED',
        }),
      }),
    );
  });

  it('should resolve simulation attempt without failureReason when result is success', async () => {
    const service = makeService();
    (service as any).getSimulationAttempt = jest.fn().mockResolvedValue({
      userId: 'user-1',
      cardId: 'simulation-attempt#sim-1#attempt-1',
      entityType: 'SIMULATION_ATTEMPT',
      attemptId: 'attempt-1',
      simulationSessionId: 'sim-1',
      targetCardId: 'card-1',
      status: 'ENTRY_SAVED',
      revealProgress: 0.4,
      entryLineYPercent: 0.4,
      stopLossLineYPercent: 0.5,
      takeProfitLineYPercent: 0.2,
      rrValue: 2,
      entryDirection: 'LONG',
      entryReason: 'entry',
      entrySavedAt: '2026-03-09T10:00:00.000Z',
      createdAt: '2026-03-09T10:00:00.000Z',
      updatedAt: '2026-03-09T10:00:00.000Z',
    });

    mockDb.get.mockResolvedValueOnce({
      Item: {
        userId: 'user-1',
        cardId: 'card-1',
        entityType: 'CARD',
        questionImageUrl: 'question-url',
        answerImageUrl: 'answer-url',
        expectedAction: 'LONG',
        createdAt: '2026-03-09T09:00:00.000Z',
        updatedAt: '2026-03-09T10:10:00.000Z',
        simulationResolvedCount: 0,
        simulationSuccessCount: 0,
        simulationFailureCount: 0,
        qualityScoreAvg: 0,
        qualityScoreCount: 0,
      },
    });

    mockDb.update
      .mockResolvedValueOnce({
        Attributes: {
          attemptId: 'attempt-1',
          status: 'RESOLVED',
          result: 'SUCCESS',
        },
      })
      .mockResolvedValueOnce({
        Attributes: {
          userId: 'user-1',
          cardId: 'simulation-session#sim-1',
          entityType: 'SIMULATION_SESSION',
          simulationSessionId: 'sim-1',
          successCount: 1,
          failureCount: 0,
          completedAttemptCount: 1,
        },
      })
      .mockResolvedValueOnce({
        Attributes: {
          userId: 'user-1',
          cardId: 'card-1',
          entityType: 'CARD',
          questionImageUrl: 'question-url',
          answerImageUrl: 'answer-url',
          expectedAction: 'LONG',
          createdAt: '2026-03-09T09:00:00.000Z',
          updatedAt: '2026-03-09T10:10:00.000Z',
          simulationResolvedCount: 1,
          simulationSuccessCount: 1,
          simulationFailureCount: 0,
          simulationSuccessRate: 1,
          qualityScoreAvg: 5,
          qualityScoreCount: 1,
        },
      });

    const result = await service.resolveSimulationAttempt('user-1', 'attempt-1', {
      result: 'SUCCESS',
      cardQualityScore: 5,
    } as any);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        UpdateExpression: expect.stringContaining('REMOVE failureReason'),
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

  it('should list simulation attempts with result filter and review fields', async () => {
    const service = makeService();
    (service as any).listAllSimulationAttempts = jest.fn().mockResolvedValue([
      {
        userId: 'user-1',
        cardId: 'simulation-attempt#sim-2#attempt-2',
        entityType: 'SIMULATION_ATTEMPT',
        attemptId: 'attempt-2',
        simulationSessionId: 'sim-2',
        targetCardId: 'card-2',
        status: 'ENTRY_SAVED',
        revealProgress: 0.3,
        entryLineYPercent: 0.42,
        stopLossLineYPercent: 0.55,
        takeProfitLineYPercent: 0.22,
        rrValue: 1.8,
        entryDirection: 'SHORT',
        entryReason: 'pending attempt',
        questionImageUrlSnapshot: 'question-2',
        answerImageUrlSnapshot: 'answer-2',
        entrySavedAt: '2026-03-15T10:00:00.000Z',
        createdAt: '2026-03-15T10:00:00.000Z',
        updatedAt: '2026-03-15T10:00:00.000Z',
      },
      {
        userId: 'user-1',
        cardId: 'simulation-attempt#sim-1#attempt-1',
        entityType: 'SIMULATION_ATTEMPT',
        attemptId: 'attempt-1',
        simulationSessionId: 'sim-1',
        targetCardId: 'card-1',
        status: 'RESOLVED',
        revealProgress: 0.43,
        replaySourceAttemptId: 'attempt-source-1',
        entryLineYPercent: 0.4,
        stopLossLineYPercent: 0.5,
        takeProfitLineYPercent: 0.2,
        rrValue: 2.4,
        entryDirection: 'LONG',
        entryReason: 'entry reason',
        result: 'FAILURE',
        failureReason: 'stopped out',
        cardQualityScore: 3,
        questionImageUrlSnapshot: 'question-1',
        answerImageUrlSnapshot: 'answer-1',
        entrySavedAt: '2026-03-14T10:00:00.000Z',
        resolvedAt: '2026-03-14T10:10:00.000Z',
        createdAt: '2026-03-14T10:00:00.000Z',
        updatedAt: '2026-03-14T10:10:00.000Z',
      },
    ]);

    const result = await service.listSimulationAttempts('user-1', {
      pageSize: 20,
      result: 'FAILURE',
    } as any);

    expect(result.success).toBe(true);
    expect(result.data.totalCount).toBe(1);
    expect(result.data.resultFilter).toBe('FAILURE');
    expect(result.data.items).toEqual([
      expect.objectContaining({
        attemptId: 'attempt-1',
        simulationSessionId: 'sim-1',
        cardId: 'card-1',
        replaySourceAttemptId: 'attempt-source-1',
        questionImageUrlSnapshot: 'question-1',
        answerImageUrlSnapshot: 'answer-1',
        revealProgress: 0.43,
        entryLineYPercent: 0.4,
        stopLossLineYPercent: 0.5,
        takeProfitLineYPercent: 0.2,
        rrValue: 2.4,
        entryReason: 'entry reason',
        result: 'FAILURE',
        failureReason: 'stopped out',
        cardQualityScore: 3,
      }),
    ]);
  });
});

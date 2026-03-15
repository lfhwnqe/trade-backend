import { NotFoundException } from '@nestjs/common';
import { FlashcardController } from './flashcard.controller';

describe('FlashcardController', () => {
  const makeReq = (extra?: Record<string, any>) =>
    ({
      user: { sub: 'user-1' },
      ...extra,
    }) as any;

  const makeController = () => {
    const flashcardService = {
      getUploadUrl: jest.fn(),
      createCard: jest.fn(),
      randomCards: jest.fn(),
      getTodaySummary: jest.fn(),
      getTodayCollectionSummary: jest.fn(),
      listCards: jest.fn(),
      deleteCard: jest.fn(),
      startSession: jest.fn(),
      submitAttempt: jest.fn(),
      finishSession: jest.fn(),
      listDrillSessions: jest.fn(),
      getDrillAnalytics: jest.fn(),
      startSimulationSession: jest.fn(),
      createSimulationAttempt: jest.fn(),
      resolveSimulationAttempt: jest.fn(),
      finishSimulationSession: jest.fn(),
      listSimulationSessions: jest.fn(),
      listSimulationAttempts: jest.fn(),
      getSimulationCardHistory: jest.fn(),
      listWrongBook: jest.fn(),
      listFavorites: jest.fn(),
      updateCardNote: jest.fn(),
      updateCard: jest.fn(),
    } as any;

    return {
      controller: new FlashcardController(flashcardService),
      flashcardService,
    };
  };

  it('should reject createCard when user info is missing', async () => {
    const { controller } = makeController();

    await expect(
      controller.createCard(makeReq({ user: undefined }), {
        questionImageUrl: 'q',
        answerImageUrl: 'a',
        expectedAction: 'LONG',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should forward submitAttempt with current user id', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.submitAttempt.mockResolvedValue({ success: true });

    const dto = {
      cardId: 'card-1',
      userAction: 'SHORT',
      isFavorite: true,
      note: '  keep this  ',
    } as any;

    const result = await controller.submitAttempt(
      makeReq(),
      'session-1',
      dto,
    );

    expect(flashcardService.submitAttempt).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      dto,
    );
    expect(result).toEqual({ success: true });
  });

  it('should forward today summary with current user id and timezone', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.getTodaySummary.mockResolvedValue({
      success: true,
      data: { date: '2026-03-09', hasNewCardsToday: true, newCardsCount: 2 },
    });

    const result = await controller.getTodaySummary(
      makeReq(),
      'Asia/Shanghai',
    );

    expect(flashcardService.getTodaySummary).toHaveBeenCalledWith(
      'user-1',
      'Asia/Shanghai',
    );
    expect(result).toEqual({
      success: true,
      data: { date: '2026-03-09', hasNewCardsToday: true, newCardsCount: 2 },
    });
  });

  it('should forward today collection summary with current user id and timezone', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.getTodayCollectionSummary.mockResolvedValue({
      success: true,
      data: {
        date: '2026-03-10',
        collectionState: 'ACTIVE_COLLECTION',
        newCardsCount: 4,
      },
    });

    const result = await controller.getTodayCollectionSummary(
      makeReq(),
      'Asia/Shanghai',
    );

    expect(flashcardService.getTodayCollectionSummary).toHaveBeenCalledWith(
      'user-1',
      'Asia/Shanghai',
    );
    expect(result).toEqual({
      success: true,
      data: {
        date: '2026-03-10',
        collectionState: 'ACTIVE_COLLECTION',
        newCardsCount: 4,
      },
    });
  });

  it('should forward analytics query with current user id', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.getDrillAnalytics.mockResolvedValue({
      success: true,
      data: { summary: { totalCompletedSessions: 0 } },
    });

    const query = { recentWindow: 30 } as any;
    const result = await controller.getDrillAnalytics(makeReq(), query);

    expect(flashcardService.getDrillAnalytics).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual({
      success: true,
      data: { summary: { totalCompletedSessions: 0 } },
    });
  });

  it('should forward create simulation attempt with current user id', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.createSimulationAttempt.mockResolvedValue({ success: true });

    const dto = {
      cardId: 'card-1',
      revealProgress: 0.43,
      entryLineYPercent: 0.4,
      stopLossLineYPercent: 0.5,
      takeProfitLineYPercent: 0.2,
      rrValue: 2,
      entryDirection: 'LONG',
      entryReason: 'reason',
    } as any;

    const result = await controller.createSimulationAttempt(makeReq(), 'sim-1', dto);

    expect(flashcardService.createSimulationAttempt).toHaveBeenCalledWith('user-1', 'sim-1', dto);
    expect(result).toEqual({ success: true });
  });

  it('should forward resolve simulation attempt with current user id', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.resolveSimulationAttempt.mockResolvedValue({ success: true });

    const dto = {
      result: 'FAILURE',
      failureReason: 'note',
      cardQualityScore: 4,
    } as any;

    const result = await controller.resolveSimulationAttempt(makeReq(), 'attempt-1', dto);

    expect(flashcardService.resolveSimulationAttempt).toHaveBeenCalledWith('user-1', 'attempt-1', dto);
    expect(result).toEqual({ success: true });
  });

  it('should forward list simulation attempts with current user id', async () => {
    const { controller, flashcardService } = makeController();
    flashcardService.listSimulationAttempts.mockResolvedValue({ success: true });

    const query = { pageSize: 20, result: 'FAILURE' } as any;
    const result = await controller.listSimulationAttempts(makeReq(), query);

    expect(flashcardService.listSimulationAttempts).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual({ success: true });
  });
});

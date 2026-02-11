import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TradeController } from './trade.controller';

describe('TradeController - image upload url guard', () => {
  const makeReq = (extra?: Record<string, any>) =>
    ({
      user: { sub: 'u1' },
      authType: 'cognito',
      apiTokenId: undefined,
      ...extra,
    }) as any;

  const makeDeps = () => {
    const tradeService = {
      getTrade: jest.fn(),
    } as any;
    const imageService = {
      consumeUploadQuota: jest.fn(),
      generateTradeUploadUrl: jest.fn(),
    } as any;
    const webhookService = {} as any;
    const controller = new TradeController(tradeService, imageService, webhookService);
    return { controller, tradeService, imageService };
  };

  const bodyBase = {
    fileName: 'a.png',
    fileType: 'image/png',
    date: '2026-02-11',
    contentLength: 123,
    source: 'trade',
  };

  it('should reject when transactionId is missing', async () => {
    const { controller } = makeDeps();
    await expect(
      controller.getTradeImageUploadUrl(makeReq(), {
        ...(bodyBase as any),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should allow draft create flow for cookie auth when trade is not found', async () => {
    const { controller, tradeService, imageService } = makeDeps();
    tradeService.getTrade.mockResolvedValue({ success: false });
    imageService.consumeUploadQuota.mockResolvedValue(undefined);
    imageService.generateTradeUploadUrl.mockResolvedValue({
      success: true,
      data: { uploadUrl: 'u', key: 'k' },
    });

    const result = await controller.getTradeImageUploadUrl(makeReq({ authType: 'cognito' }), {
      ...(bodyBase as any),
      transactionId: 'draft-123',
      source: 'trade',
    });

    expect(result).toEqual({ success: true, data: { uploadUrl: 'u', key: 'k' } });
    expect(imageService.consumeUploadQuota).toHaveBeenCalled();
    expect(imageService.generateTradeUploadUrl).toHaveBeenCalled();
  });

  it('should reject api token upload when transactionId trade is not found', async () => {
    const { controller, tradeService } = makeDeps();
    tradeService.getTrade.mockResolvedValue({ success: false });

    await expect(
      controller.getTradeImageUploadUrl(makeReq({ authType: 'apiToken' }), {
        ...(bodyBase as any),
        transactionId: 'draft-123',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

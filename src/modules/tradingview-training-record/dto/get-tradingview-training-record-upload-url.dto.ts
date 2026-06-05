import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import {
  TRADINGVIEW_TRAINING_RECORD_IMAGE_SCOPE_VALUES,
  TradingViewTrainingRecordImageScope,
} from '../tradingview-training-record.types';

export class GetTradingViewTrainingRecordUploadUrlDto {
  @ApiProperty({ example: 'training.png' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  contentType: string;

  @ApiProperty({ example: 'training-image', enum: TRADINGVIEW_TRAINING_RECORD_IMAGE_SCOPE_VALUES })
  @IsString()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_IMAGE_SCOPE_VALUES)
  scope: TradingViewTrainingRecordImageScope;
}

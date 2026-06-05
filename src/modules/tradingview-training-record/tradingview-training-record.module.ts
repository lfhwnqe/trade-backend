import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { TradingViewTrainingRecordController } from './tradingview-training-record.controller';
import { TradingViewTrainingRecordService } from './tradingview-training-record.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [TradingViewTrainingRecordController],
  providers: [TradingViewTrainingRecordService],
  exports: [TradingViewTrainingRecordService],
})
export class TradingViewTrainingRecordModule {}

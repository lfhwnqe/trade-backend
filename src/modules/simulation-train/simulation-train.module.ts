import { Module } from '@nestjs/common';
import { SimulationTrainController } from './simulation-train.controller';
import { SimulationTrainService } from './simulation-train.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [SimulationTrainController],
  providers: [SimulationTrainService],
})
export class SimulationTrainModule {}
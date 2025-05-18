import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module'; // Added import

@Module({
  imports: [CommonModule], // Added CommonModule
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

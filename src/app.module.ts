import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module'; // Added import
import { UserModule } from './user/user.module'; // Added UserModule import

@Module({
  imports: [CommonModule, UserModule], // Added CommonModule and UserModule
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

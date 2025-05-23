import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CommonModule } from '../common/common.module'; // To access ConfigService

@Module({
  imports: [CommonModule], // Import CommonModule here
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export UserService if other modules need to inject it
})
export class UserModule {}

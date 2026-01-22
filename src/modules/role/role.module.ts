import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [CommonModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}

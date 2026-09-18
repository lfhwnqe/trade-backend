import { AdministratorAccessService } from '../common/administrator-access.service';
import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ImageController],
  providers: [ImageService, AdministratorAccessService],
})
export class ImageModule {}

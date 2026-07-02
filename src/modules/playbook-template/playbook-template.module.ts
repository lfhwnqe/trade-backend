import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { PlaybookTemplateController } from './playbook-template.controller';
import { PlaybookTemplateService } from './playbook-template.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [PlaybookTemplateController],
  providers: [PlaybookTemplateService],
  exports: [PlaybookTemplateService],
})
export class PlaybookTemplateModule {}

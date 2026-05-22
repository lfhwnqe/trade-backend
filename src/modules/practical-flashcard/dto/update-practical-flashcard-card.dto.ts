import { PartialType, PickType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreatePracticalFlashcardCardDto } from './create-practical-flashcard-card.dto';
import {
  PRACTICAL_FLASHCARD_STATUS_VALUES,
  PracticalFlashcardStatus,
} from '../practical-flashcard.types';

export class UpdatePracticalFlashcardCardDto extends PartialType(
  PickType(CreatePracticalFlashcardCardDto, [
    'expectedDirection',
    'standardEntryPrice',
    'standardStopLossPrice',
    'standardTakeProfitPrice',
    'playbookType',
    'tagCodes',
    'orderFlowImageUrls',
    'orderFlowRemark',
    'notes',
    'summary',
  ] as const),
) {
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_STATUS_VALUES)
  status?: PracticalFlashcardStatus;
}

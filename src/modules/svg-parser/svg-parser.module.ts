import { Module } from '@nestjs/common';
import { SVGParserController } from './svg-parser.controller';
import { SVGParserService } from './svg-parser.service';
import { SVGElementExtractorService } from './services/svg-element-extractor.service';
import { DataTransformService } from './services/data-transform.service';
import { ValidationService } from './services/validation.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { LoggingService } from './services/logging.service';

@Module({
  controllers: [SVGParserController],
  providers: [
    SVGParserService,
    SVGElementExtractorService,
    DataTransformService,
    ValidationService,
    PerformanceMonitorService,
    LoggingService,
  ],
  exports: [SVGParserService],
})
export class SVGParserModule {}

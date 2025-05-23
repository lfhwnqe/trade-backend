import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from './modules/common/config.service'; // Import ConfigService

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService, // Inject ConfigService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

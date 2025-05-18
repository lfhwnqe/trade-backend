import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from './common/config.service'; // Import ConfigService

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

  @Get('config-logs') // New endpoint
  getConfigLogs(): string {
    const dotEnvConfigs = this.configService.getDotEnvEntries();
    console.log('.env Configurations:', JSON.stringify(dotEnvConfigs, null, 2));
    return 'config logs';
  }
}

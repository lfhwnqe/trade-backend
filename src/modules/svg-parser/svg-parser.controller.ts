import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { SVGParserService } from './svg-parser.service';
import {
  SVGParseRequestDto,
  SVGParseFromUrlDto,
  SVGParseFromStringDto,
  SVGParseResponseDto,
  InputType,
} from './dto/svg-parse.dto';

@ApiTags('SVG解析引擎')
@Controller('svg-parser')
export class SVGParserController {
  private readonly logger = new Logger(SVGParserController.name);

  constructor(private readonly svgParserService: SVGParserService) {}

  @Post('parse')
  @ApiOperation({
    summary: '解析SVG内容',
    description: '通用SVG解析接口，支持多种输入类型',
  })
  @ApiResponse({
    status: 200,
    description: '解析成功',
    type: SVGParseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误',
  })
  @ApiResponse({
    status: 500,
    description: '服务器内部错误',
  })
  async parseSVG(
    @Body() parseRequest: SVGParseRequestDto,
  ): Promise<SVGParseResponseDto> {
    this.logger.log(`开始解析SVG，输入类型: ${parseRequest.inputType}`);

    try {
      const result = await this.svgParserService.parseSVG({
        input: parseRequest.input,
        inputType: parseRequest.inputType,
        options: parseRequest.options,
      });

      this.logger.log(
        `SVG解析完成，节点数: ${result.data?.nodes.length || 0}, 边数: ${result.data?.edges.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`SVG解析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('parse-url')
  @ApiOperation({
    summary: '从URL解析SVG',
    description: '从Whimsical脑图URL或SVG文件URL解析',
  })
  @ApiResponse({
    status: 200,
    description: '解析成功',
    type: SVGParseResponseDto,
  })
  async parseSVGFromUrl(
    @Body() parseRequest: SVGParseFromUrlDto,
  ): Promise<SVGParseResponseDto> {
    this.logger.log(`开始从URL解析SVG: ${parseRequest.url}`);

    try {
      const result = await this.svgParserService.parseSVG({
        input: parseRequest.url,
        inputType: InputType.URL,
        options: parseRequest.options,
      });

      this.logger.log(
        `URL SVG解析完成，节点数: ${result.data?.nodes.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`URL SVG解析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('parse-string')
  @ApiOperation({
    summary: '从字符串解析SVG',
    description: '直接从SVG字符串内容解析',
  })
  @ApiResponse({
    status: 200,
    description: '解析成功',
    type: SVGParseResponseDto,
  })
  async parseSVGFromString(
    @Body() parseRequest: SVGParseFromStringDto,
  ): Promise<SVGParseResponseDto> {
    this.logger.log('开始从字符串解析SVG');

    try {
      const result = await this.svgParserService.parseSVG({
        input: parseRequest.svgContent,
        inputType: InputType.STRING,
        options: parseRequest.options,
      });

      this.logger.log(
        `字符串SVG解析完成，节点数: ${result.data?.nodes.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`字符串SVG解析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('parse-file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '从文件解析SVG',
    description: '上传SVG文件进行解析',
  })
  @ApiResponse({
    status: 200,
    description: '解析成功',
    type: SVGParseResponseDto,
  })
  async parseSVGFromFile(
    @UploadedFile() file: any,
    @Body('options') optionsStr?: string,
  ): Promise<SVGParseResponseDto> {
    if (!file) {
      throw new BadRequestException('请上传SVG文件');
    }

    if (!file.originalname.toLowerCase().endsWith('.svg')) {
      throw new BadRequestException('请上传有效的SVG文件');
    }

    this.logger.log(`开始从文件解析SVG: ${file.originalname}`);

    try {
      let options: any;
      if (optionsStr) {
        try {
          options = JSON.parse(optionsStr);
        } catch (error) {
          throw new BadRequestException('解析选项格式错误');
        }
      }

      const result = await this.svgParserService.parseSVG({
        input: file.buffer.toString('utf-8'),
        inputType: InputType.STRING,
        options,
      });

      this.logger.log(
        `文件SVG解析完成，节点数: ${result.data?.nodes.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`文件SVG解析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('validate')
  @ApiOperation({ summary: '验证SVG格式', description: '验证SVG内容是否有效' })
  @ApiResponse({
    status: 200,
    description: '验证结果',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async validateSVG(@Body() parseRequest: SVGParseFromStringDto) {
    this.logger.log('开始验证SVG格式');

    try {
      const result = await this.svgParserService.validateSVG(
        parseRequest.svgContent,
      );
      this.logger.log(`SVG验证完成，有效性: ${result.valid}`);
      return result;
    } catch (error) {
      this.logger.error(`SVG验证失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}

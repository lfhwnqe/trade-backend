import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { MistakeService } from './mistake.service';
import { CreateMistakeRecordDto } from './dto/create-mistake-record.dto';
import { ListMistakeRecordsDto } from './dto/list-mistake-records.dto';
import { UpdateMistakeRecordDto } from './dto/update-mistake-record.dto';

@ApiTags('Mistakes')
@ApiBearerAuth()
@Controller('mistakes')
export class MistakeController {
  constructor(private readonly mistakeService: MistakeService) {}

  @ApiOperation({ summary: '创建误判记录' })
  @ApiBody({ type: CreateMistakeRecordDto })
  @Post('records')
  async createRecord(@Req() req: Request, @Body() dto: CreateMistakeRecordDto) {
    return this.mistakeService.createRecord(this.getUserId(req), dto);
  }

  @ApiOperation({ summary: '查询误判记录列表' })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'sourceType', required: false })
  @ApiQuery({ name: 'primaryMistakeCode', required: false })
  @ApiQuery({ name: 'mistakeDomain', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'reviewStatus', required: false })
  @Get('records')
  async listRecords(@Req() req: Request, @Query() query: ListMistakeRecordsDto) {
    return this.mistakeService.listRecords(this.getUserId(req), query);
  }

  @ApiOperation({ summary: '查询误判记录详情' })
  @ApiParam({ name: 'mistakeRecordId' })
  @ApiResponse({ status: 200, description: '返回误判记录详情' })
  @Get('records/:mistakeRecordId')
  async getRecord(@Req() req: Request, @Param('mistakeRecordId') mistakeRecordId: string) {
    return this.mistakeService.getRecord(this.getUserId(req), mistakeRecordId);
  }

  @ApiOperation({ summary: '更新误判记录' })
  @ApiParam({ name: 'mistakeRecordId' })
  @ApiBody({ type: UpdateMistakeRecordDto })
  @Patch('records/:mistakeRecordId')
  async updateRecord(
    @Req() req: Request,
    @Param('mistakeRecordId') mistakeRecordId: string,
    @Body() dto: UpdateMistakeRecordDto,
  ) {
    return this.mistakeService.updateRecord(this.getUserId(req), mistakeRecordId, dto);
  }

  private getUserId(req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }
    return userId;
  }
}

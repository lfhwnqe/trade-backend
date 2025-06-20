import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
  ApiErrorResponses,
} from '../decorators/api-response.decorators';
import { ResponseHelper } from '../utils/response.helper';

/**
 * 响应格式标准化示例控制器
 *
 * 演示如何使用标准化响应格式系统：
 * 1. 标准成功响应
 * 2. 分页响应
 * 3. 错误响应
 * 4. 自定义响应格式
 */
@ApiTags('响应格式示例')
@Controller('examples')
export class ExampleController {
  /**
   * 示例1：标准成功响应 - 直接返回数据
   * 响应拦截器会自动封装为标准格式
   */
  @ApiOperation({
    summary: '标准成功响应示例',
    description: '演示如何返回标准格式的成功响应，响应拦截器会自动封装数据',
  })
  @ApiStandardResponse({
    status: 200,
    description: '获取用户信息成功',
    type: 'object',
  })
  @Get('standard-response')
  async getStandardResponse() {
    // 直接返回数据，响应拦截器会自动封装为标准格式
    return {
      id: 1,
      name: '张三',
      email: 'zhangsan@example.com',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 示例2：使用 ResponseHelper 创建标准响应
   */
  @ApiOperation({
    summary: '使用ResponseHelper的标准响应',
    description: '演示如何使用ResponseHelper工具类创建标准响应格式',
  })
  @ApiStandardResponse({
    status: 201,
    description: '创建交易记录成功',
    type: 'object',
  })
  @Post('helper-response')
  @HttpCode(HttpStatus.CREATED)
  async getHelperResponse(@Body() createData: any) {
    // 模拟业务逻辑
    const result = {
      transactionId: `tx_${Date.now()}`,
      symbol: createData.symbol || 'BTCUSDT',
      amount: createData.amount || 0.1,
      price: createData.price || 45000,
      status: '已创建',
    };

    // 使用 ResponseHelper 创建标准响应
    return ResponseHelper.success(result, '交易记录创建成功');
  }

  /**
   * 示例3：分页响应
   */
  @ApiOperation({
    summary: '分页响应示例',
    description: '演示如何返回分页格式的响应数据',
  })
  @ApiQuery({ name: 'page', description: '页码', required: false, example: 1 })
  @ApiQuery({
    name: 'pageSize',
    description: '每页数量',
    required: false,
    example: 10,
  })
  @ApiQuery({ name: 'keyword', description: '搜索关键词', required: false })
  @ApiPaginatedResponse({
    status: 200,
    description: '获取交易记录列表成功',
    type: 'object',
  })
  @Get('paginated-response')
  async getPaginatedResponse(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('keyword') keyword?: string,
  ) {
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    // 模拟分页数据
    const mockData = Array.from({ length: 25 }, (_, index) => ({
      id: `${index + 1}`,
      symbol: index % 2 === 0 ? 'BTCUSDT' : 'ETHUSDT',
      amount: Math.random(),
      price: index % 2 === 0 ? 45000 + index * 100 : 3000 + index * 50,
      createdAt: new Date(Date.now() - index * 3600000).toISOString(),
      keyword: keyword ? `匹配关键词: ${keyword}` : undefined,
    }));

    // 过滤数据（如果有关键词）
    const filteredData = keyword
      ? mockData.filter((item) =>
          item.symbol.toLowerCase().includes(keyword.toLowerCase()),
        )
      : mockData;

    // 计算分页
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const pageData = filteredData.slice(startIndex, endIndex);

    // 使用 ResponseHelper 创建分页响应
    return ResponseHelper.paginated(
      pageData,
      pageNum,
      pageSizeNum,
      filteredData.length,
      '获取交易记录列表成功',
    );
  }

  /**
   * 示例4：触发验证错误 - 演示错误响应格式
   */
  @ApiOperation({
    summary: '验证错误响应示例',
    description: '演示当输入数据验证失败时的错误响应格式',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'age'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'user@example.com',
        },
        age: {
          type: 'number',
          minimum: 18,
          maximum: 100,
          example: 25,
        },
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 50,
          example: '张三',
        },
      },
    },
  })
  @ApiErrorResponses([
    {
      status: 400,
      description: '输入数据验证失败',
    },
  ])
  @Post('validation-error')
  async triggerValidationError(@Body() data: any) {
    // 手动验证演示
    const errors: string[] = [];

    if (!data.email || !data.email.includes('@')) {
      errors.push('邮箱格式不正确');
    }

    if (!data.age || data.age < 18) {
      errors.push('年龄必须大于等于18岁');
    }

    if (!data.name || data.name.length < 2) {
      errors.push('姓名长度至少2个字符');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join(', '));
    }

    return ResponseHelper.success(data, '数据验证通过');
  }

  /**
   * 示例5：触发404错误
   */
  @ApiOperation({
    summary: '资源不存在错误示例',
    description: '演示当请求的资源不存在时的错误响应格式',
  })
  @ApiParam({ name: 'id', description: '资源ID', example: '999' })
  @ApiErrorResponses([
    {
      status: 404,
      description: '资源不存在',
    },
  ])
  @Get('not-found/:id')
  async triggerNotFound(@Param('id') id: string) {
    // 模拟查找资源
    if (id === '999') {
      throw new NotFoundException(`ID为 ${id} 的交易记录不存在`);
    }

    return ResponseHelper.success(
      { id, name: `交易记录 ${id}`, status: '正常' },
      '获取交易记录成功',
    );
  }

  /**
   * 示例6：服务器内部错误
   */
  @ApiOperation({
    summary: '服务器内部错误示例',
    description: '演示服务器内部错误时的响应格式',
  })
  @ApiErrorResponses([
    {
      status: 500,
      description: '服务器内部错误',
    },
  ])
  @Get('server-error')
  async triggerServerError() {
    // 模拟服务器错误
    throw new Error('这是一个模拟的服务器内部错误');
  }

  /**
   * 示例7：自定义成功响应
   */
  @ApiOperation({
    summary: '自定义成功响应示例',
    description: '演示如何创建带有自定义消息和元数据的成功响应',
  })
  @ApiStandardResponse({
    status: 200,
    description: '操作完成',
    type: 'object',
  })
  @Post('custom-success')
  async customSuccessResponse() {
    // 模拟批量处理操作
    const result = {
      result: 'success',
      processedCount: 150,
      skippedCount: 5,
    };

    return ResponseHelper.success(result, '批量处理操作已完成');
  }
}
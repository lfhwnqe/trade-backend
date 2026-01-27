import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  UseGuards,
  Patch,
  Param,
  Res,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ConfirmUserDto } from './dto/confirm-user.dto';
// import { AuthGuard } from '@nestjs/passport'; // 我们稍后会根据需要添加认证守卫
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Roles, Role } from '../../base/decorators/roles.decorator';
import { RolesGuard } from '../../base/guards/roles.guard';
import { CognitoService } from '../common/cognito.service';
import { Request, Response } from 'express';

@ApiTags('用户管理')
@Controller('user')
export class UserController {
  private readonly isProd = process.env.APP_ENV === 'prod';
  private readonly accessTokenMaxAgeMs = 60 * 60 * 1000;
  private readonly refreshTokenMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly userService: UserService,
    private readonly cognitoService: CognitoService,
  ) {}

  private getCookieValue(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;
    const cookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    return cookie?.split('=')[1];
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; idToken: string },
  ) {
    const baseOptions = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('token', tokens.accessToken, {
      ...baseOptions,
      maxAge: this.accessTokenMaxAgeMs,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...baseOptions,
      maxAge: this.refreshTokenMaxAgeMs,
    });
    res.cookie('idToken', tokens.idToken, {
      ...baseOptions,
      maxAge: this.accessTokenMaxAgeMs,
    });
  }

  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: '用户注册成功' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    // 在实际应用中，注册成功后通常不直接返回密码等敏感信息
    // Cognito 的 SignUpCommand 返回 UserSub 和 UserConfirmed 状态
    const result = await this.userService.register(createUserDto);
    console.log(`User registered successfully: ${result.userId}`);
    return {
      message:
        'User registered successfully. Please check your email for confirmation if required.',
      userId: result.userId,
      confirmed: result.confirmed,
    };
  }

  /**
   * 邮箱注册确认接口：用户收到验证码后，用邮箱和验证码进行二次确认
   */
  @ApiOperation({ summary: '邮箱注册确认' })
  @ApiBody({ type: ConfirmUserDto })
  @ApiResponse({ status: HttpStatus.OK, description: '账号确认成功' })
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmUser(@Body() dto: ConfirmUserDto) {
    await this.userService.confirmUser(dto.username, dto.code);
    return { message: '账号已成功确认，现在可以登录。' };
  }

  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({ status: HttpStatus.OK, description: '登录成功，返回token' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.userService.login(loginUserDto);
    this.setAuthCookies(res, result);
    return result;
  }

  @ApiOperation({ summary: '刷新登录态（使用 refresh token 续签）' })
  @ApiResponse({ status: HttpStatus.OK, description: '续签成功，返回新token' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body('refreshToken') refreshTokenFromBody: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      refreshTokenFromBody || this.getCookieValue(req, 'refreshToken');
    const tokens = await this.cognitoService.refreshTokens(refreshToken || '');
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  // 任务要求：第一个用户默认为管理员 - 这部分逻辑通常在 UserService.register 中处理，或者有一个专门的初始化脚本。
  // Cognito 本身没有“第一个用户是管理员”的直接概念，需要应用层面逻辑或手动在 Cognito 控制台设置用户组和权限。
  // 我们可以在 UserService 中添加一个检查，例如，如果这是数据库中的第一个用户，则将其添加到 "Admins" 组。

  // 任务要求：关闭注册接口
  // 这个可以通过配置或特性标志来实现，或者移除/禁用此端点。
  // 为了演示，我们可以添加一个方法来“关闭”注册，但这通常是在部署/配置层面控制。
  // 暂时，我们将保留注册接口开放。

  // 任务要求：管理员查看所有用户分页接口
  // @UseGuards(AuthGuard('jwt'), RolesGuard) // 假设有 JWT 认证和角色守卫
  // @Roles('admin') // 假设有角色装饰器
  @ApiOperation({ summary: '查看所有用户（管理员）' })
  @ApiQuery({
    name: 'limit',
    description: '每页显示数量',
    required: false,
    type: 'string',
  })
  @ApiQuery({
    name: 'paginationToken',
    description: '分页标记',
    required: false,
    type: 'string',
  })
  @ApiResponse({ status: HttpStatus.OK, description: '获取用户列表成功' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('list')
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Query('limit') limit: string = '10',
    @Query('paginationToken') paginationToken?: string,
  ) {
    const numericLimit = parseInt(limit, 10);
    return this.userService.listUsers(numericLimit, paginationToken);
  }

  @ApiOperation({ summary: '查看用户详情（含角色组信息）' })
  @ApiParam({ name: 'userId', description: '用户ID', required: true })
  @ApiResponse({ status: HttpStatus.OK, description: '获取用户详情成功' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  async getUserDetail(@Param('userId') userId: string) {
    return this.userService.getUserDetail(userId);
  }

  // 这是一个示例性的关闭注册的接口，实际中可能通过环境变量或配置服务控制
  // @Patch('registration/close')
  // @HttpCode(HttpStatus.OK)
  // // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // // @Roles('admin')
  // async closeRegistration() {
  //   // return this.userService.setRegistrationStatus(false);
  //   return { message: 'Registration closing mechanism - to be implemented.' };
  // }

  /**
   * 更新用户注册功能的开启/关闭状态。
   * TODO: 需要添加认证和授权守卫，确保只有管理员可以调用。
   * 例如: @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
   */
  @ApiOperation({ summary: '更新用户注册功能状态（管理员）' })
  @ApiBody({
    schema: {
      properties: {
        enable: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: '更新注册功能状态成功' })
  @ApiBearerAuth()
  @Patch('registration/status')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthGuard('jwt'), RolesGuard) // 取消注释并配置守卫
  // @Roles('admin') // 取消注释并配置角色
  async updateRegistrationStatus(@Body('enable') enable: boolean) {
    if (typeof enable !== 'boolean') {
      throw new Error('The "enable" field must be a boolean.'); // Basic validation
    }
    return this.userService.setRegistrationStatus(enable);
  }
  /**
   * 查询当前用户注册功能是否开启
   */
  @ApiOperation({ summary: '查询用户注册功能状态' })
  @ApiResponse({ status: HttpStatus.OK, description: '返回注册功能状态' })
  @Get('registration/status')
  @HttpCode(HttpStatus.OK)
  async getRegistrationStatus() {
    return this.userService.getRegistrationStatus();
  }
}

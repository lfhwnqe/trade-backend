import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import { Roles, Role } from '../../base/decorators/roles.decorator';
import { RolesGuard } from '../../base/guards/roles.guard';

@ApiTags('角色管理')
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @ApiOperation({ summary: '初始化固定角色组' })
  @ApiResponse({ status: HttpStatus.OK, description: '角色组初始化完成' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Post('init')
  @HttpCode(HttpStatus.OK)
  async initRoles() {
    return this.roleService.initRoles();
  }

  @ApiOperation({ summary: '查询角色列表（固定角色）' })
  @ApiResponse({ status: HttpStatus.OK, description: '角色列表查询成功' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('list')
  @HttpCode(HttpStatus.OK)
  async listRoles() {
    return this.roleService.listRoles();
  }
}

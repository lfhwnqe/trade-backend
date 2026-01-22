import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoException,
  ResourceNotFoundException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ConfigService } from '../common/config.service';
import {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  GetGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly allowedRoles = [
    Role.Admin,
    Role.SuperAdmin,
    Role.FreePlan,
    Role.ProPlan,
  ];

  constructor(private readonly configService: ConfigService) {
    this.userPoolId = this.configService.get('USER_POOL_ID');
    const region = this.configService.get('AWS_REGION');

    if (!this.userPoolId || !region) {
      this.logger.error('Cognito User Pool ID or AWS Region is missing.');
      throw new CognitoException(
        'Cognito configuration is missing or incomplete.',
        ERROR_CODES.COGNITO_CONFIG_ERROR,
        '认证服务配置异常，请联系管理员',
        { userPoolId: this.userPoolId, region },
      );
    }

    this.cognitoClient = new CognitoIdentityProviderClient({ region });
  }

  private ensureAllowedRole(groupName: string) {
    if (!this.allowedRoles.includes(groupName as Role)) {
      throw new ValidationException(
        `Group name is not allowed: ${groupName}`,
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        '角色名称不合法',
        { groupName, allowedRoles: this.allowedRoles },
      );
    }
  }

  async getRole(groupName: string) {
    if (!groupName) {
      throw new ValidationException(
        'Group name is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '角色名称不能为空',
      );
    }
    this.ensureAllowedRole(groupName);

    try {
      const response = await this.cognitoClient.send(
        new GetGroupCommand({
          UserPoolId: this.userPoolId,
          GroupName: groupName,
        }),
      );

      return response.Group;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        throw new ResourceNotFoundException(
          `Group not found: ${groupName}`,
          ERROR_CODES.COGNITO_GROUP_NOT_FOUND,
          '角色不存在',
          { groupName },
        );
      }

      throw new CognitoException(
        `Failed to fetch group: ${error.message}`,
        ERROR_CODES.COGNITO_GROUP_GET_FAILED,
        '查询角色失败，请稍后重试',
        { groupName, error: error.name },
      );
    }
  }

  async listRoles() {
    const groups = [];

    for (const groupName of this.allowedRoles) {
      try {
        const response = await this.cognitoClient.send(
          new GetGroupCommand({
            UserPoolId: this.userPoolId,
            GroupName: groupName,
          }),
        );
        if (response.Group) {
          groups.push(response.Group);
        }
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          continue;
        }
        throw new CognitoException(
          `Failed to fetch group: ${error.message}`,
          ERROR_CODES.COGNITO_GROUP_LIST_FAILED,
          '查询角色列表失败，请稍后重试',
          { groupName, error: error.name },
        );
      }
    }

    return { groups };
  }

  async initRoles() {
    const created: string[] = [];
    const existing: string[] = [];

    for (const groupName of this.allowedRoles) {
      try {
        const response = await this.cognitoClient.send(
          new GetGroupCommand({
            UserPoolId: this.userPoolId,
            GroupName: groupName,
          }),
        );
        if (response.Group) {
          existing.push(groupName);
          continue;
        }
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          throw new CognitoException(
            `Failed to fetch group: ${error.message}`,
            ERROR_CODES.COGNITO_GROUP_GET_FAILED,
            '查询角色失败，请稍后重试',
            { groupName, error: error.name },
          );
        }
      }

      try {
        await this.cognitoClient.send(
          new CreateGroupCommand({
            UserPoolId: this.userPoolId,
            GroupName: groupName,
          }),
        );
        created.push(groupName);
      } catch (error: any) {
        if (error.name === 'GroupExistsException') {
          existing.push(groupName);
          continue;
        }
        throw new CognitoException(
          `Failed to create group: ${error.message}`,
          ERROR_CODES.COGNITO_GROUP_CREATE_FAILED,
          '创建角色失败，请稍后重试',
          { groupName, error: error.name },
        );
      }
    }

    return { created, existing };
  }

  async updateUserRole(userId: string, role: Role) {
    if (!userId) {
      throw new ValidationException(
        'UserId is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '用户ID不能为空',
      );
    }
    this.ensureAllowedRole(role);

    try {
      const groupResponse = await this.cognitoClient.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: this.userPoolId,
          Username: userId,
        }),
      );
      const existingGroups =
        groupResponse.Groups?.map((group) => group.GroupName).filter(Boolean) ||
        [];

      const allowedGroups = existingGroups.filter((groupName) =>
        this.allowedRoles.includes(groupName as Role),
      );

      for (const groupName of allowedGroups) {
        if (groupName === role) {
          continue;
        }
        await this.cognitoClient.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
            GroupName: groupName,
          }),
        );
      }

      if (!existingGroups.includes(role)) {
        await this.cognitoClient.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
            GroupName: role,
          }),
        );
      }

      return { userId, role };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new ResourceNotFoundException(
          `User not found: ${userId}`,
          ERROR_CODES.COGNITO_USER_NOT_FOUND,
          '用户不存在',
          { userId },
        );
      }
      if (error.name === 'GroupNotFoundException') {
        throw new CognitoException(
          `Group "${role}" not found`,
          ERROR_CODES.COGNITO_GROUP_NOT_FOUND,
          '用户组不存在',
          { role },
        );
      }
      throw new CognitoException(
        `Failed to update user role: ${error.message}`,
        ERROR_CODES.COGNITO_ADD_USER_TO_GROUP_FAILED,
        '更新用户角色失败，请稍后重试',
        { userId, role, error: error.name },
      );
    }
  }
}

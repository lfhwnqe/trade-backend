import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoException,
  ValidationException,
  BusinessException,
  AuthenticationException,
  ResourceNotFoundException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ConfigService } from '../common/config.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ListUsersCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private registrationGloballyEnabled: boolean = true; // Default to true
  constructor(private readonly configService: ConfigService) {
    this.userPoolId = this.configService.get('USER_POOL_ID'); // Changed to uppercase
    this.clientId = this.configService.get('USER_POOL_CLIENT_ID'); // Changed to uppercase

    console.log(`UserPoolId: ${this.userPoolId}`);
    console.log(`ClientId: ${this.clientId}`);

    const region = this.configService.get('AWS_REGION');
    console.log(`UserService Initializing with Config (using console.log):`);
    console.log(`- AWS_REGION: ${region}`);
    console.log(`- USER_POOL_ID: ${this.userPoolId}`);
    console.log(`- USER_POOL_CLIENT_ID: ${this.clientId}`);

    if (!this.userPoolId || !this.clientId || !region) {
      console.error(
        'Cognito User Pool ID, Client ID, or AWS Region is not configured properly via console.log.',
      );
      throw new CognitoException(
        'Cognito configuration is missing or incomplete.',
        ERROR_CODES.COGNITO_CONFIG_ERROR,
        '认证服务配置异常，请联系管理员',
        { userPoolId: this.userPoolId, clientId: this.clientId, region },
      );
    }

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: region,
    });
  }

  /**
   * 确认用户注册邮箱验证码
   * @param email 邮箱
   * @param code 验证码
   */
  async confirmUser(username: string, code: string): Promise<void> {
    try {
      await this.cognitoClient.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: username,
          ConfirmationCode: code,
        }),
      );
      this.logger.log(`用户[${username}] 验证码注册确认成功。`);
    } catch (err) {
      this.logger.error(`注册验证码验证失败: ${err}`);
      if (err.name === 'CodeMismatchException') {
        throw new ValidationException(
          'Confirmation code mismatch',
          ERROR_CODES.COGNITO_CODE_MISMATCH,
          '验证码错误，请检查邮件中的验证码',
          { username, error: err.name },
        );
      }
      if (err.name === 'ExpiredCodeException') {
        throw new ValidationException(
          'Confirmation code expired',
          ERROR_CODES.COGNITO_CODE_EXPIRED,
          '验证码已过期，请重新注册或请求新的验证码',
          { username, error: err.name },
        );
      }
      if (err.name === 'UserNotFoundException') {
        throw new ResourceNotFoundException(
          `User not found: ${username}`,
          ERROR_CODES.COGNITO_USER_NOT_FOUND,
          '未找到该用户，请检查用户名是否正确',
          { username },
        );
      }
      throw new CognitoException(
        `User confirmation failed: ${err.message}`,
        ERROR_CODES.COGNITO_VERIFICATION_FAILED,
        '验证码验证失败，请稍后重试',
        { username, error: err.name },
      );
    }
  }

  async register(
    createUserDto: CreateUserDto,
  ): Promise<{ userId: string; confirmed: boolean }> {
    if (!this.registrationGloballyEnabled) {
      this.logger.warn(
        'User registration is globally disabled. Blocking registration attempt.',
      );
      throw new BusinessException(
        'User registration is globally disabled',
        ERROR_CODES.USER_REGISTRATION_DISABLED,
        '用户注册当前已禁用',
      );
    }

    const { username, email, password } = createUserDto;
    this.logger.log(`Registering user: ${username} with email: ${email}`);
    try {
      const defaultRole = Role.FreePlan;
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: username, // Use username for Cognito Username
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'custom:role', Value: defaultRole },
        ], // email attribute remains as email
      });
      const response = await this.cognitoClient.send(command);
      this.logger.log(
        `User ${username} (email: ${email}) registered successfully. UserSub: ${response.UserSub}`,
      );

      // Attempt to make the first user an admin
      try {
        const listUsersCommand = new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Limit: 1, // We only need to know if there are any users other than the one just created
        });
        const existingUsers = await this.cognitoClient.send(listUsersCommand);

        // If no users existed before this one (or only this one exists now, depending on timing)
        // A more robust check might be needed for high concurrency scenarios.
        // For simplicity, if existingUsers.Users is empty or contains only the new user,
        // we assume this is effectively the first "active" user.
        // A simpler, though less precise, approach for "first user" could be to check if a specific flag/setting exists.
        // Here, we'll assume if the count is very low (e.g., 0 or 1 before this registration fully propagates),
        // it's the first user.
        // A direct count isn't easily available, so we check if the list is very small.
        // This logic is a placeholder and might need refinement for production.
        // A common pattern is to have a separate "seed" script or manual process for the first admin.

        let isFirstUser = false;
        if (!existingUsers.Users || existingUsers.Users.length === 0) {
          isFirstUser = true;
        } else if (
          existingUsers.Users.length === 1 &&
          existingUsers.Users[0].Username === username // Compare with username
        ) {
          // If the only user listed is the one just created
          isFirstUser = true;
        }

        if (isFirstUser) {
          this.logger.log(
            `Attempting to add first user ${username} to admin group.`,
          );
          await this.adminAddUserToAdminGroup(username); // Use username for adding to group
        }
      } catch (adminError: any) {
        // Log the error but don't let it fail the registration process
        this.logger.error(
          `Failed to add user ${username} to admin group during registration: ${adminError.message}`,
          adminError.stack,
        );
      }

      try {
        await this.adminAddUserToGroup(username, defaultRole);
      } catch (groupError: any) {
        this.logger.error(
          `Failed to add user ${username} to default group ${defaultRole}: ${groupError.message}`,
          groupError.stack,
        );
      }

      return { userId: response.UserSub!, confirmed: response.UserConfirmed };
    } catch (error: any) {
      this.logger.error(
        `Error registering user ${username} (email: ${email}): ${error.message}`,
        error.stack,
      );
      // 可以根据 Cognito 返回的错误类型进行更细致的处理
      throw new CognitoException(
        `Failed to register user: ${error.message}`,
        ERROR_CODES.COGNITO_REGISTRATION_FAILED,
        '用户注册失败，请稍后重试',
        { username, email, error: error.name },
      );
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
    username: string;
    email: string;
    role: string;
  }> {
    const { email, password } = loginUserDto;
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });
      const response = await this.cognitoClient.send(command);
      if (response.AuthenticationResult) {
        this.logger.log(`User ${email} logged in successfully.`);
        let username = email;
        let role: Role | string = Role.FreePlan;
        try {
          const listUsersCommand = new ListUsersCommand({
            UserPoolId: this.userPoolId,
            Filter: `email = "${email}"`,
            Limit: 1,
          });
          const listResponse = await this.cognitoClient.send(listUsersCommand);
          const matchedUser = listResponse.Users?.[0];
          if (matchedUser?.Username) {
            username = matchedUser.Username;
          } else {
            this.logger.warn(
              `User lookup by email returned no username for ${email}.`,
            );
          }
          const roleAttribute = matchedUser?.Attributes?.find(
            (attribute) => attribute.Name === 'custom:role',
          );
          if (roleAttribute?.Value) {
            role = roleAttribute.Value;
          }
          if (matchedUser?.Username) {
            try {
              const groupResponse = await this.cognitoClient.send(
                new AdminListGroupsForUserCommand({
                  UserPoolId: this.userPoolId,
                  Username: matchedUser.Username,
                }),
              );
              const groupNames =
                groupResponse.Groups?.map((group) => group.GroupName).filter(
                  Boolean,
                ) || [];
              const prioritizedRoles = [
                Role.SuperAdmin,
                Role.Admin,
                Role.ProPlan,
                Role.FreePlan,
              ];
              const groupRole = prioritizedRoles.find((candidateRole) =>
                groupNames.includes(candidateRole),
              );
              if (groupRole) {
                role = groupRole;
              }
            } catch (groupError: any) {
              this.logger.warn(
                `Failed to resolve groups for ${email}: ${groupError.message}`,
              );
            }
          }
        } catch (lookupError: any) {
          this.logger.warn(
            `Failed to resolve username by email for ${email}: ${lookupError.message}`,
          );
        }
        return {
          accessToken: response.AuthenticationResult.AccessToken!,
          refreshToken: response.AuthenticationResult.RefreshToken!,
          idToken: response.AuthenticationResult.IdToken!,
          username,
          email,
          role,
        };
      } else {
        // 通常 InitiateAuthCommand 成功时会返回 AuthenticationResult
        // 如果没有，可能意味着需要其他认证流程（例如 MFA），或者配置问题
        this.logger.error(`Authentication result missing for user ${email}.`);
        throw new AuthenticationException(
          'Login failed, authentication result missing',
          ERROR_CODES.AUTH_VERIFICATION_FAILED,
          '登录失败，认证结果缺失',
          { email },
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error logging in user ${email}: ${error.message}`,
        error.stack,
      );
      if (
        error.name === 'NotAuthorizedException' ||
        error.name === 'UserNotFoundException'
      ) {
        throw new AuthenticationException(
          'Invalid email or password',
          ERROR_CODES.COGNITO_INVALID_PASSWORD,
          '邮箱或密码错误',
          { email, error: error.name },
        );
      }
      throw new CognitoException(
        `Login failed: ${error.message}`,
        ERROR_CODES.COGNITO_LOGIN_FAILED,
        '登录失败，请稍后重试',
        { email, error: error.name },
      );
    }
  }

  // 后续会在这里添加 isFirstUser, closeRegistration, listUsers 等方法

  async listUsers(
    limit: number = 10,
    paginationToken?: string,
  ): Promise<{ users: any[]; nextToken?: string }> {
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
      });
      const response = await this.cognitoClient.send(command);
      const users =
        response.Users?.map((user) => ({
          userId: user.Username,
          attributes: user.Attributes || [],
          enabled: user.Enabled,
          userStatus: user.UserStatus,
          createdAt: user.UserCreateDate,
          lastModifiedAt: user.UserLastModifiedDate,
        })) || [];

      this.logger.log(
        `Successfully listed users. Count: ${users.length}, NextToken: ${response.PaginationToken}`,
      );
      return { users, nextToken: response.PaginationToken };
    } catch (error: any) {
      this.logger.error(`Error listing users: ${error.message}`, error.stack);
      throw new CognitoException(
        `Failed to list users: ${error.message}`,
        ERROR_CODES.COGNITO_USER_LIST_FAILED,
        '获取用户列表失败，请稍后重试',
        { error: error.name },
      );
    }
  }

  async getUserDetail(userId: string): Promise<{
    userId: string;
    attributes: { Name?: string; Value?: string }[];
    enabled?: boolean;
    userStatus?: string;
    createdAt?: Date;
    lastModifiedAt?: Date;
    groups: string[];
  }> {
    if (!userId) {
      throw new ValidationException(
        'UserId is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '用户ID不能为空',
      );
    }
    try {
      const userResponse = await this.cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: userId,
        }),
      );
      const groupResponse = await this.cognitoClient.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: this.userPoolId,
          Username: userId,
        }),
      );
      const groups =
        groupResponse.Groups?.map((group) => group.GroupName).filter(Boolean) ||
        [];

      return {
        userId,
        attributes: userResponse.UserAttributes || [],
        enabled: userResponse.Enabled,
        userStatus: userResponse.UserStatus,
        createdAt: userResponse.UserCreateDate,
        lastModifiedAt: userResponse.UserLastModifiedDate,
        groups,
      };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new ResourceNotFoundException(
          `User not found: ${userId}`,
          ERROR_CODES.COGNITO_USER_NOT_FOUND,
          '用户不存在',
          { userId },
        );
      }
      throw new CognitoException(
        `Failed to get user detail: ${error.message}`,
        ERROR_CODES.COGNITO_USER_LIST_FAILED,
        '获取用户详情失败，请稍后重试',
        { userId, error: error.name },
      );
    }
  }

  async adminAddUserToAdminGroup(username: string): Promise<void> {
    const adminGroupName =
      this.configService.get('COGNITO_ADMIN_GROUP_NAME') || 'Admins';
    await this.adminAddUserToGroup(username, adminGroupName);
  }

  async adminAddUserToGroup(
    username: string,
    groupName: string,
  ): Promise<void> {
    try {
      const command = new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName,
      });
      await this.cognitoClient.send(command);
      this.logger.log(
        `Successfully added user ${username} to group ${groupName}.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error adding user ${username} to group ${groupName}: ${error.message}`,
        error.stack,
      );
      // 特定错误处理，例如 UserNotFoundException, GroupNotFoundException
      if (error.name === 'UserNotFoundException') {
        throw new ResourceNotFoundException(
          `User ${username} not found`,
          ERROR_CODES.COGNITO_USER_NOT_FOUND,
          '用户不存在',
          { username },
        );
      }
      if (error.name === 'GroupNotFoundException') {
        this.logger.error(
          `Cognito group "${groupName}" not found. Please create it in the AWS Cognito console.`,
        );
        throw new CognitoException(
          `Group "${groupName}" not found`,
          ERROR_CODES.COGNITO_GROUP_NOT_FOUND,
          `用户组"${groupName}"不存在`,
          { groupName },
        );
      }
      throw new CognitoException(
        `Failed to add user ${username} to group ${groupName}: ${error.message}`,
        ERROR_CODES.COGNITO_ADD_USER_TO_GROUP_FAILED,
        '添加用户到用户组失败，请稍后重试',
        { username, groupName, error: error.name },
      );
    }
  }

  async setRegistrationStatus(enable: boolean): Promise<{ status: boolean }> {
    this.registrationGloballyEnabled = enable;
    this.logger.log(`User registration status set to: ${enable}`);
    return { status: this.registrationGloballyEnabled };
  }
  getRegistrationStatus(): { enable: boolean } {
    return { enable: this.registrationGloballyEnabled };
  }
}

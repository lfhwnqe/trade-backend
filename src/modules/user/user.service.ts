import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ListUsersCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

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
      throw new InternalServerErrorException(
        'Cognito configuration is missing or incomplete.',
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
        throw new ForbiddenException('验证码错误，请检查邮件中的验证码。');
      }
      if (err.name === 'ExpiredCodeException') {
        throw new ForbiddenException(
          '验证码已过期，请重新注册或请求新的验证码。',
        );
      }
      if (err.name === 'UserNotFoundException') {
        throw new NotFoundException('未找到该用户，请检查用户名是否正确。');
      }
      throw new InternalServerErrorException('验证码验证失败，请稍后重试。');
    }
  }

  async register(
    createUserDto: CreateUserDto,
  ): Promise<{ userId: string; confirmed: boolean }> {
    if (!this.registrationGloballyEnabled) {
      this.logger.warn(
        'User registration is globally disabled. Blocking registration attempt.',
      );
      throw new ForbiddenException('User registration is currently disabled.');
    }

    const { username, email, password } = createUserDto;
    this.logger.log(`Registering user: ${username} with email: ${email}`);
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: username, // Use username for Cognito Username
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }], // email attribute remains as email
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

      return { userId: response.UserSub!, confirmed: response.UserConfirmed };
    } catch (error: any) {
      this.logger.error(
        `Error registering user ${username} (email: ${email}): ${error.message}`,
        error.stack,
      );
      // 可以根据 Cognito 返回的错误类型进行更细致的处理
      throw new InternalServerErrorException(
        `Failed to register user: ${error.message}`,
      );
    }
  }

  async login(
    loginUserDto: LoginUserDto,
  ): Promise<{ accessToken: string; refreshToken: string; idToken: string }> {
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
        return {
          accessToken: response.AuthenticationResult.AccessToken!,
          refreshToken: response.AuthenticationResult.RefreshToken!,
          idToken: response.AuthenticationResult.IdToken!,
        };
      } else {
        // 通常 InitiateAuthCommand 成功时会返回 AuthenticationResult
        // 如果没有，可能意味着需要其他认证流程（例如 MFA），或者配置问题
        this.logger.error(`Authentication result missing for user ${email}.`);
        throw new UnauthorizedException(
          'Login failed, authentication result missing.',
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
        throw new UnauthorizedException('Invalid email or password.');
      }
      throw new InternalServerErrorException(`Login failed: ${error.message}`);
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
          attributes: user.Attributes,
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
      throw new InternalServerErrorException(
        `Failed to list users: ${error.message}`,
      );
    }
  }

  async adminAddUserToAdminGroup(username: string): Promise<void> {
    const adminGroupName =
      this.configService.get('COGNITO_ADMIN_GROUP_NAME') || 'Admins';
    try {
      const command = new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: adminGroupName,
      });
      await this.cognitoClient.send(command);
      this.logger.log(
        `Successfully added user ${username} to group ${adminGroupName}.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error adding user ${username} to group ${adminGroupName}: ${error.message}`,
        error.stack,
      );
      // 特定错误处理，例如 UserNotFoundException, GroupNotFoundException
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundException(`User ${username} not found.`);
      }
      if (error.name === 'GroupNotFoundException') {
        this.logger.error(
          `Cognito group "${adminGroupName}" not found. Please create it in the AWS Cognito console.`,
        );
        throw new InternalServerErrorException(
          `Admin group "${adminGroupName}" not found.`,
        );
      }
      throw new InternalServerErrorException(
        `Failed to add user ${username} to admin group: ${error.message}`,
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

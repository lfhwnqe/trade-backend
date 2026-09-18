import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from './config.service';

@Injectable()
export class AdministratorAccessService {
  private readonly client: CognitoIdentityProviderClient;
  constructor(private readonly config: ConfigService) {
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow('AWS_REGION'),
    });
  }
  async assertOwner(userId: string) {
    // Resolve immutable Cognito sub to Username; never trust a token's stale group claims.
    if (!/^[a-f0-9-]{36}$/i.test(userId || ''))
      throw new ForbiddenException('Administrator required');
    const UserPoolId = this.config.getOrThrow('USER_POOL_ID');
    const users = await this.client.send(
      new ListUsersCommand({
        UserPoolId,
        Filter: `sub = "${userId}"`,
        Limit: 2,
      }),
    );
    const Username =
      users.Users?.length === 1 ? users.Users[0].Username : undefined;
    if (!Username)
      throw new ForbiddenException('Administrator required');
    const account = await this.client.send(
      new AdminGetUserCommand({ UserPoolId, Username }),
    );
    if (!account.Enabled)
      throw new ForbiddenException('Administrator account disabled');
    let NextToken: string | undefined;
    do {
      const page = await this.client.send(
        new AdminListGroupsForUserCommand({ UserPoolId, Username, NextToken }),
      );
      if (
        page.Groups?.some((g) =>
          ['Admins', 'SuperAdmins'].includes(g.GroupName),
        )
      )
        return;
      NextToken = page.NextToken;
    } while (NextToken);
    throw new ForbiddenException('Administrator required');
  }
}

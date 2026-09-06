import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from '../common/config.service';

@Injectable()
export class BridgeAccessService {
  private readonly client: CognitoIdentityProviderClient;
  constructor(private readonly config: ConfigService) {
    this.client = new CognitoIdentityProviderClient({
      region: config.getOrThrow('AWS_REGION'),
    });
  }
  async assertOwner(userId: string) {
    // Resolve immutable Cognito sub to Username; never trust a token's stale group claims.
    if (!/^[a-f0-9-]{36}$/i.test(userId || ''))
      throw new ForbiddenException('Bridge administrator required');
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
      throw new ForbiddenException('Bridge administrator required');
    const account = await this.client.send(
      new AdminGetUserCommand({ UserPoolId, Username }),
    );
    if (!account.Enabled)
      throw new ForbiddenException('Bridge account disabled');
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
    throw new ForbiddenException('Bridge administrator required');
  }
}

@Injectable()
export class BridgeGuard implements CanActivate {
  constructor(private readonly access: BridgeAccessService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.user?.sub)
      throw new ForbiddenException('Bridge identity required');
    if (
      req.authType === 'apiToken' &&
      (req.route?.path?.includes('hooks') ||
        req.route?.path?.includes('notifications'))
    )
      throw new ForbiddenException(
        'Bridge management requires a login session',
      );
    // Reuse existing tokens, with explicit operation mapping; no new token system.
    const required = req.method === 'GET' ? 'trade:read' : 'trade:write';
    if (req.authType === 'apiToken' && !req.scopes?.includes(required))
      throw new ForbiddenException('Bridge scope denied');
    await this.access.assertOwner(req.user.sub);
    return true;
  }
}

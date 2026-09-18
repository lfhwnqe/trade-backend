import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AdministratorAccessService as BridgeAccessService } from '../common/administrator-access.service';

// Keep the Bridge provider and guard contract while sharing live role verification.
export { BridgeAccessService };

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

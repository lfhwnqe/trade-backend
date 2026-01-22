import { SetMetadata } from '@nestjs/common';

export enum Role {
  Admin = 'Admins',
  SuperAdmin = 'SuperAdmins',
  FreePlan = 'FreePlan',
  ProPlan = 'ProPlan',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

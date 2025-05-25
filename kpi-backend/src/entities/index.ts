import { Permission } from './permission.entity';
import { Policy } from './policy.entity';
import { Role } from './role.entity';
import { ReviewCycle } from './review-cycle.entity';

export * from './role.entity';

export const entities = [Permission, Policy, Role, ReviewCycle];

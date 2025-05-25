import { SetMetadata } from '@nestjs/common';

export interface PermissionMeta {
  action: string;
  resource: string;
}

export const PERMISSION_METADATA_KEY = 'permission';

export const Permission = (action: string, resource: string) =>
  SetMetadata(PERMISSION_METADATA_KEY, { action, resource });

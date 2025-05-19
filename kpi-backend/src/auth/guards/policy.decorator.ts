import { SetMetadata } from '@nestjs/common';

export const POLICY_CHECK_KEY = 'policy_check';
export const PolicyCheck = (policy: string, options?: any) => SetMetadata(POLICY_CHECK_KEY, { policy, options });

import type { Role } from '@utl/shared';

import type { Permission } from '@/config/constants.js';

declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      tenantId: string;
      role: Role;
      permissions: ReadonlySet<Permission>;
      sessionId?: string;
    }

    interface Request {
      id?: string;
      auth?: AuthContext;
      tenantId?: string;
    }
  }
}

export {};

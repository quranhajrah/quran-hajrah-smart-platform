import type { IdentityUser, RequestMeta } from './identity/types.js';

declare global {
  namespace Express {
    interface Request {
      identity?: IdentityUser;
      context: RequestMeta;
    }
  }
}

export {};

import { createHmac, randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { AppConfig } from '../config.js';

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/\d/, 'Password must contain a number.');

export const hashPassword = (password: string, rounds: number) => hash(password, rounds);
export const verifyPassword = (password: string, passwordHash: string) => compare(password, passwordHash);
export const createRefreshToken = () => randomBytes(48).toString('base64url');
export const hashToken = (token: string, secret: string) => createHmac('sha256', secret).update(token).digest('hex');

export const signAccessToken = (userId: string, config: AppConfig) =>
  new SignJWT({ type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.accessTokenTtl)
    .sign(new TextEncoder().encode(config.accessTokenSecret));

export const verifyAccessToken = async (token: string, config: AppConfig) => {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.accessTokenSecret), {
    algorithms: ['HS256'],
  });
  if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid access token.');
  return payload.sub;
};

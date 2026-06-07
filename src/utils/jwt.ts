import jwt from 'jsonwebtoken';

function getSecret(): string {
  return process.env.JWT_SECRET || 'phongthuy_default_jwt_secret_key_123456';
}

export interface TokenPayload {
  id?: number | string;
  userId?: number;
  role?: 'admin' | 'user';
  orderId?: number;
}

export function signToken(payload: TokenPayload, expiresIn: string | number = '24h'): string {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn as any });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}

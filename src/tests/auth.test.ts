import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { signToken, verifyToken } from '@/utils/jwt';
import { requireAdmin, requireUser } from '@/middlewares/auth.middleware';
import { Request, Response, NextFunction } from 'express';

describe('Kiểm thử JWT Helpers - utils/jwt.ts', () => {
  test('Tạo và xác thực token thành công', () => {
    const payload = { id: 'admin', role: 'admin' as const };
    const token = signToken(payload, '1h');
    expect(token).toBeDefined();
    
    const decoded = verifyToken(token);
    expect(decoded.id).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  test('Xác thực token bị lỗi khi token không hợp lệ', () => {
    expect(() => verifyToken('invalid-token-string')).toThrow();
  });
});

describe('Kiểm thử Auth Middleware - middlewares/auth.middleware.ts', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      cookies: {}
    };
    mockResponse = {};
    nextFunction = jest.fn() as unknown as NextFunction;
  });

  test('requireAdmin - Trả về lỗi khi thiếu cookie admin_token', () => {
    requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED'
      })
    );
  });

  test('requireAdmin - Cho phép đi qua khi có cookie admin_token hợp lệ', () => {
    const token = signToken({ id: 'admin', role: 'admin' }, '1h');
    mockRequest.cookies = { admin_token: token };

    requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.admin).toBeDefined();
    expect(mockRequest.admin?.id).toBe('admin');
    expect(mockRequest.admin?.role).toBe('admin');
    expect(nextFunction).toHaveBeenCalledWith(); // Gọi next() thành công không lỗi
  });

  test('requireUser - Trả về lỗi khi thiếu cookie user_token', () => {
    requireUser(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED'
      })
    );
  });

  test('requireUser - Cho phép đi qua khi có cookie user_token hợp lệ', () => {
    const token = signToken({ userId: 123, role: 'user' }, '1h');
    mockRequest.cookies = { user_token: token };

    requireUser(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe(123);
    expect(nextFunction).toHaveBeenCalledWith();
  });
});

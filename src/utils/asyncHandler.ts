import { Request, Response, NextFunction } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Wrapper bọc các Express request handler bất đồng bộ
 * để tự động bắt lỗi và chuyển tiếp sang NextFunction (Error Middleware)
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

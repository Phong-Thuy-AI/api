import { Request, Response, NextFunction } from 'express';
import { sendError } from '@/utils/response';
import { logError } from '@/services/logger.service';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Middleware xử lý lỗi toàn cục cho Express app
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Có lỗi hệ thống xảy ra. Vui lòng thử lại sau.';
  let details = err.details || [];

  // Phân loại một số lỗi phổ biến của Sequelize ORM
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    code = 'UNIQUE_CONSTRAINT_ERROR';
    message = 'Thông tin đăng ký bị trùng lặp (Email hoặc Số điện thoại đã tồn tại trong hệ thống).';
    // @ts-ignore
    details = err.errors?.map((e: any) => ({
      field: e.path,
      message: e.message
    })) || [];
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu đầu vào không hợp lệ.';
    // @ts-ignore
    details = err.errors?.map((e: any) => ({
      field: e.path,
      message: e.message
    })) || [];
  } 
  // Phân loại lỗi của JWT Token
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Mã xác thực không hợp lệ hoặc bị thay đổi.';
  }

  // Ghi log lỗi vào console
  console.error(`[ERROR] [${req.method} ${req.originalUrl}] ${code} (${statusCode}) - ${err.message}`);
  if (statusCode === 500) {
    console.error(err);
  }

  // Tự động lưu log lỗi vào cơ sở dữ liệu system_logs
  const level = statusCode >= 500 ? 'error' : 'warn';
  logError({
    level,
    source: 'api',
    statusCode,
    method: req.method,
    path: req.originalUrl || req.url,
    message: `${code}: ${message}`,
    stack: err.stack || null,
    metadata: {
      params: req.params,
      query: req.query,
      body: req.body ? { ...req.body, password: req.body.password ? '***' : undefined } : null,
      ip: req.ip || req.headers['x-forwarded-for'] || null,
      user: (req as any).user || null
    }
  }).catch(e => console.error('[ErrorHandler] Failed to save logError:', e));

  return sendError(res, code, message, details, statusCode);
};

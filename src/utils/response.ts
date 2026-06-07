import { Response } from 'express';

/**
 * Phản hồi thành công chuẩn của hệ thống
 */
export function sendSuccess(res: Response, data: any, message = 'Thành công', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * Phản hồi lỗi chuẩn của hệ thống
 */
export function sendError(res: Response, errorCode: string, message: string, details: any = [], statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details
    }
  });
}

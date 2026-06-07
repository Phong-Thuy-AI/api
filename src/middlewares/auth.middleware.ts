import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/utils/jwt';

// Mở rộng kiểu dữ liệu Request của Express để lưu giữ thông tin admin và user sau khi xác thực
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        role: string;
      };
      user?: {
        userId: number;
        role?: string;
      };
    }
  }
}

/**
 * Middleware yêu cầu quyền truy cập của Admin (xác thực cookie admin_token)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.admin_token;
    
    if (!token) {
      return next({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Bạn chưa đăng nhập quản trị viên.'
      });
    }

    const decoded = verifyToken(token);
    if (decoded.role !== 'admin') {
      return next({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập vào tài nguyên quản trị.'
      });
    }

    req.admin = {
      id: decoded.id as string,
      role: decoded.role
    };
    next();
  } catch (error) {
    next(error); // Chuyển tiếp lỗi (sai signature, hết hạn) về errorHandler middleware
  }
};

/**
 * Middleware yêu cầu quyền truy cập của Khách hàng (xác thực cookie user_token)
 */
export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.user_token;

    if (!token) {
      return next({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Phiên truy cập của khách hàng đã hết hạn hoặc không tồn tại.'
      });
    }

    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId as number,
      role: decoded.role
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware chấp nhận cả Khách hàng hoặc Admin (ví dụ trong phòng chat chung)
 */
export const requireUserOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminToken = req.cookies?.admin_token;
    const userToken = req.cookies?.user_token;

    if (!adminToken && !userToken) {
      return next({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Không tìm thấy phiên đăng nhập.'
      });
    }

    // 1. Kiểm tra quyền Admin trước
    if (adminToken) {
      try {
        const decoded = verifyToken(adminToken);
        if (decoded.role === 'admin') {
          req.admin = {
            id: decoded.id as string,
            role: decoded.role
          };
          return next();
        }
      } catch (err) {
        // Nếu token admin lỗi nhưng không có token user thì báo lỗi token admin
        if (!userToken) return next(err);
      }
    }

    // 2. Kiểm tra quyền User
    if (userToken) {
      const decoded = verifyToken(userToken);
      req.user = {
        userId: decoded.userId as number,
        role: decoded.role
      };
      return next();
    }

    return next({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Xác thực tài khoản không hợp lệ.'
    });
  } catch (error) {
    next(error);
  }
};

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User, Order, ChatRoom } from '@/models';
import { signToken } from '@/utils/jwt';
import { sendSuccess } from '@/utils/response';
import { PACKAGE_TYPE_200K, ORDER_PAID, ORDER_COMPLETED } from '@/utils/constants';

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME và ADMIN_PASSWORD phải được cấu hình trong biến môi trường.');
  }
  return { username, password };
}

/**
 * Xử lý đăng nhập Admin
 */
export async function loginAdmin(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Tài khoản và mật khẩu không được để trống.'
    };
  }

  const credentials = getAdminCredentials();
  if (username !== credentials.username || password !== credentials.password) {
    throw {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Tài khoản hoặc mật khẩu quản trị viên không chính xác.'
    };
  }

  // Ký token JWT đại diện cho Admin
  const token = signToken({ id: 'admin', role: 'admin' }, '24h');

  // Đặt cookie HttpOnly bảo mật ở Client
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // Hạn sử dụng: 24 giờ
  });

  return sendSuccess(res, { username }, 'Đăng nhập hệ thống quản trị thành công.');
}

/**
 * Xử lý đăng xuất Admin
 */
export async function logoutAdmin(req: Request, res: Response) {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return sendSuccess(res, null, 'Đăng xuất khỏi hệ thống quản trị thành công.');
}

/**
 * Lấy thông tin tài khoản Admin đang hoạt động
 */
export async function getAdminProfile(req: Request, res: Response) {
  return sendSuccess(res, { username: getAdminCredentials().username }, 'Lấy thông tin phiên làm việc thành công.');
}

/**
 * Tra cứu đơn hàng theo Email + SĐT — khôi phục session cho user mất cookie
 * POST /api/v1/auth/user/lookup
 */
export async function lookupUser(req: Request, res: Response) {
  const { email, phone } = req.body;

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Email không đúng định dạng.' };
    }
  }
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Số điện thoại phải chứa tối thiểu 6 chữ số.' };
  }

  const user = await User.findOne({ where: { phone: cleanPhone } });
  if (!user) {
    throw {
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'Không tìm thấy khách hàng với số điện thoại này. Vui lòng kiểm tra lại.'
    };
  }

  const orders = await Order.findAll({
    where: { userId: user.id, status: { [Op.in]: [ORDER_PAID, ORDER_COMPLETED] } },
    order: [['createdAt', 'DESC']]
  });

  const ordersWithRoom = await Promise.all(
    orders.map(async (o) => {
      let chatRoomId: number | null = null;
      if (o.packageType === PACKAGE_TYPE_200K) {
        const room = await ChatRoom.findOne({ where: { orderId: o.id } });
        if (room) chatRoomId = room.id;
      }
      const sourceType = (await ChatRoom.findOne({ where: { orderId: o.id } }))?.sourceType ?? null;
      return {
        id: o.id,
        packageType: o.packageType,
        status: o.status,
        createdAt: o.createdAt,
        carrier: o.carrier,
        consultationTopic: o.consultationTopic,
        chatRoomId,
        sourceType
      };
    })
  );

  const token = signToken({ userId: user.id, role: 'user' }, '30d');
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('user_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      menh: user.menh,
      focusArea: user.focusArea,
      referralCode: user.referralCode,
      lastCheckResult: user.lastCheckResult
    },
    orders: ordersWithRoom
  }, 'Tra cứu thông tin khách hàng thành công.');
}

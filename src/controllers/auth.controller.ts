import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User, Order, ChatRoom } from '@/models';
import { signToken, verifyToken } from '@/utils/jwt';
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

/**
 * Lấy thông tin profile người dùng hiện tại qua token cookie
 * GET /api/v1/auth/user/me
 */
export async function getUserProfile(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'Bạn chưa đăng nhập.' };
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Không tìm thấy thông tin người dùng.' };
  }

  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      menh: user.menh,
      focusArea: user.focusArea,
      horoscopeExpiresAt: user.horoscopeExpiresAt,
      trialUsed: user.trialUsed
    }
  }, 'Lấy thông tin profile thành công.');
}

/**
 * Đăng ký dùng thử tử vi 1 tháng miễn phí
 * POST /api/v1/auth/user/subscribe-trial
 */
export async function subscribeTrial(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'Bạn chưa đăng nhập.' };
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Không tìm thấy thông tin người dùng.' };
  }

  if (user.trialUsed) {
    throw { statusCode: 400, code: 'TRIAL_ALREADY_USED', message: 'Mỗi khách hàng chỉ được đăng ký dùng thử miễn phí 1 lần.' };
  }

  const { email } = req.body;
  if (!user.email) {
    if (!email) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Vui lòng cung cấp địa chỉ email để nhận tử vi hằng ngày.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Địa chỉ email không đúng định dạng.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    
    // Kiểm tra xem email đã được đăng ký bởi tài khoản khác chưa
    const existingUser = await User.findOne({
      where: {
        email: cleanEmail,
        id: { [Op.ne]: userId }
      }
    });
    if (existingUser) {
      throw { statusCode: 400, code: 'EMAIL_ALREADY_EXISTS', message: 'Địa chỉ email này đã được đăng ký bởi khách hàng khác.' };
    }
    
    user.email = cleanEmail;
  }

  // Nếu người dùng đăng ký tử vi mà chưa chọn vấn đề cải vận thì gán mặc định
  if (!user.focusArea) {
    user.focusArea = 'Công việc'; // Giá trị mặc định
  }

  const now = new Date();
  user.horoscopeExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 ngày dùng thử
  user.trialUsed = true;
  user.expiryEmailSent = false; // reset flag khi đăng ký mới
  await user.save();

  return sendSuccess(res, {
    id: user.id,
    email: user.email,
    horoscopeExpiresAt: user.horoscopeExpiresAt,
    trialUsed: user.trialUsed
  }, 'Đăng ký dùng thử 1 tháng tử vi hằng ngày miễn phí thành công!');
}

/**
 * Tự động đăng nhập qua link gửi trong email và chuyển hướng sang trang gia hạn
 * GET /api/v1/auth/user/renew-login
 */
export async function renewLogin(req: Request, res: Response) {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).send('Mã xác thực không hợp lệ hoặc thiếu.');
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded.userId) {
      return res.status(400).send('Mã xác thực không hợp lệ.');
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).send('Người dùng không tồn tại.');
    }

    // Thiết lập cookie đăng nhập của người dùng
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('user_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày
    });

    return res.redirect(`${clientUrl}/renew`);
  } catch (err) {
    console.error('[Auth] renewLogin error:', err);
    return res.status(401).send('Mã xác thực đã hết hạn hoặc không hợp lệ.');
  }
}

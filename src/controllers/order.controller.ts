import { Request, Response } from 'express';
import { Order, User, ChatRoom } from '@/models';
import { generatePaymentCode, generateQrUrl, pollPaymentStatus } from '@/services/payment.service';
import { sendSuccess } from '@/utils/response';
import {
  ORDER_PAID, ORDER_COMPLETED,
  PACKAGE_TYPE_500K,
  CREDIT_DAYS_200K, CREDIT_DAYS_500K,
  CHAT_ROOM_CLOSED
} from '@/utils/constants';

/**
 * API Tạo đơn hàng mới
 * POST /api/v1/orders
 */
export async function createOrder(req: Request, res: Response) {
  const { packageType, carrier, consultationTopic } = req.body;

  let targetUserId = req.user?.userId;

  if (!packageType || !['200k', '500k'].includes(packageType)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Loại gói dịch vụ không hợp lệ (chỉ chấp nhận gói 200k hoặc 500k).' };
  }

  // Validate metadata bắt buộc theo gói
  if (packageType === '200k' && !carrier) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Vui lòng chọn nhà mạng muốn tư vấn.' };
  }
  if (packageType === '500k' && !consultationTopic) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Vui lòng chọn vấn đề cần tư vấn chuyên sâu.' };
  }

  if (req.admin && req.body.userId) {
    targetUserId = req.body.userId;
    const userExists = await User.findByPk(targetUserId);
    if (!userExists) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Không tìm thấy người dùng được yêu cầu tạo đơn hàng.' };
    }
  } else {
    if (req.body.userId && Number(req.body.userId) !== targetUserId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền tạo đơn hàng cho người dùng khác.' };
    }
  }

  if (!targetUserId) {
    if (req.admin && !req.body.userId) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Admin phải cung cấp userId để tạo đơn hàng.' };
    }
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Không xác định được thông tin người dùng tạo đơn hàng.' };
  }

  // 1. Kiểm tra xem đã có đơn hàng nào của gói này ở trạng thái 'paid' mà phòng chat vẫn active không
  const paidOrder = await Order.findOne({
    where: {
      userId: targetUserId,
      packageType,
      status: 'paid'
    },
    order: [['createdAt', 'DESC']]
  });

  if (paidOrder) {
    const chatRoom = await ChatRoom.findOne({ where: { orderId: paidOrder.id, status: 'active' } });
    if (chatRoom) {
      throw {
        statusCode: 409,
        code: 'ORDER_ALREADY_PAID',
        message: 'Bạn đã đăng ký và thanh toán gói dịch vụ này rồi. Đang chuyển hướng vào phòng tư vấn...',
        details: { chatRoomId: chatRoom.id }
      };
    }
  }

  // 2. Kiểm tra xem đã có đơn hàng nào của gói này đang ở trạng thái 'pending' dưới 10 phút không
  const existingOrder = await Order.findOne({
    where: {
      userId: targetUserId,
      packageType,
      status: 'pending'
    },
    order: [['createdAt', 'DESC']]
  });

  if (existingOrder) {
    const qrAge = Date.now() - new Date(existingOrder.createdAt).getTime();
    if (qrAge <= 10 * 60 * 1000) {
      const qrUrl = generateQrUrl(existingOrder.amount, existingOrder.paymentCode);
      return sendSuccess(
        res,
        {
          order: {
            id: existingOrder.id,
            userId: existingOrder.userId,
            packageType: existingOrder.packageType,
            amount: existingOrder.amount,
            paymentCode: existingOrder.paymentCode,
            status: existingOrder.status,
            carrier: existingOrder.carrier,
            consultationTopic: existingOrder.consultationTopic,
            createdAt: existingOrder.createdAt
          },
          qrUrl
        },
        'Khôi phục đơn hàng cải vận đang chờ thanh toán.',
        200
      );
    } else {
      existingOrder.status = 'expired';
      await existingOrder.save();
    }
  }

  const amount = packageType === '200k' ? 200000 : 500000;
  const paymentCode = await generatePaymentCode();

  const order = await Order.create({
    userId: targetUserId,
    packageType,
    amount,
    paymentCode,
    status: 'pending',
    carrier: carrier || null,
    consultationTopic: consultationTopic || null
  });

  // Đồng bộ focusArea của User
  if (consultationTopic) {
    const user = await User.findByPk(targetUserId);
    if (user) {
      user.focusArea = consultationTopic;
      await user.save();
    }
  }

  const qrUrl = generateQrUrl(amount, paymentCode);

  return sendSuccess(
    res,
    {
      order: {
        id: order.id,
        userId: order.userId,
        packageType: order.packageType,
        amount: order.amount,
        paymentCode: order.paymentCode,
        status: order.status,
        carrier: order.carrier,
        consultationTopic: order.consultationTopic,
        createdAt: order.createdAt
      },
      qrUrl
    },
    'Khởi tạo đơn hàng cải vận thành công.',
    201
  );
}

/**
 * API Polling kiểm tra trạng thái thanh toán đơn hàng
 * GET /api/v1/orders/:orderId/status
 */
export async function checkOrderPaymentStatus(req: Request, res: Response) {
  const orderId = parseInt(String(req.params.orderId), 10);

  if (isNaN(orderId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã đơn hàng đầu vào không hợp lệ.' };
  }

  const order = await Order.findByPk(orderId);
  if (!order) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Đơn hàng không tồn tại.' };
  }

  if (req.user && !req.admin) {
    if (order.userId !== req.user.userId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền truy cập thông tin đơn hàng này.' };
    }
  }

  const result = await pollPaymentStatus(orderId);

  // Trả chatRoomId cho cả 200k và 500k khi đã thanh toán
  let chatRoomId: number | null = null;
  if (result.paid) {
    const chatRoom = await ChatRoom.findOne({ where: { orderId: result.order.id } });
    if (chatRoom) chatRoomId = chatRoom.id;
  }

  return sendSuccess(
    res,
    { paid: result.paid, status: result.order.status, chatRoomId },
    result.paid ? 'Đơn hàng đã được thanh toán thành công.' : 'Đơn hàng đang chờ thanh toán.'
  );
}

/**
 * Admin hoàn thành đơn hàng — kích hoạt subscription + thưởng referral + đóng ChatRoom.
 * PATCH /api/v1/orders/:orderId/complete
 */
export async function completeOrder(req: Request, res: Response) {
  const orderId = parseInt(String(req.params.orderId), 10);
  if (isNaN(orderId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã đơn hàng không hợp lệ.' };
  }

  const order = await Order.findByPk(orderId, {
    include: [{ model: User, as: 'user' }]
  });

  if (!order) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Đơn hàng không tồn tại.' };
  }

  if (order.status !== ORDER_PAID) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: `Chỉ có thể hoàn thành đơn hàng ở trạng thái "${ORDER_PAID}".` };
  }

  // Số ngày subscription theo gói: 200k=30d, 500k=90d
  const creditDays = order.packageType === PACKAGE_TYPE_500K ? CREDIT_DAYS_500K : CREDIT_DAYS_200K;
  const now = new Date();

  const orderUser = (order as any).user as User | null;
  if (orderUser) {
    const currentExpiry = orderUser.horoscopeExpiresAt;
    orderUser.horoscopeExpiresAt = currentExpiry && currentExpiry > now
      ? new Date(currentExpiry.getTime() + creditDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000);
    await orderUser.save();

    if (orderUser.referredByCode) {
      const referrer = await User.findOne({ where: { referralCode: orderUser.referredByCode } });
      if (referrer) {
        if (referrer.referralBonusMonths < 12) {
          const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
          const base = referrer.horoscopeExpiresAt && referrer.horoscopeExpiresAt > now
            ? referrer.horoscopeExpiresAt.getTime()
            : now.getTime();
          referrer.horoscopeExpiresAt = new Date(base + ONE_MONTH_MS);
          referrer.referralBonusMonths += 1;
          await referrer.save();
          console.log(`[Order] Referral +1 month: ${referrer.email} (referred ${orderUser.email}). Total bonus months: ${referrer.referralBonusMonths}`);
        } else {
          console.log(`[Order] Referrer ${referrer.email} already reached max 12 bonus months. Skipping bonus.`);
        }
      }
    }
  }

  // Đóng ChatRoom khi đơn hoàn thành
  const chatRoom = await ChatRoom.findOne({ where: { orderId: order.id } });
  if (chatRoom) {
    chatRoom.status = CHAT_ROOM_CLOSED;
    await chatRoom.save();
  }

  order.status = ORDER_COMPLETED;
  await order.save();

  return sendSuccess(
    res,
    { orderId, status: ORDER_COMPLETED },
    `Đơn hàng hoàn thành. Kích hoạt ${creditDays} ngày nhắc vận cho khách hàng.`
  );
}

/**
 * API Bỏ qua thanh toán đơn hàng (Chỉ dành cho TEST)
 * POST /api/v1/orders/:orderId/bypass-pay
 */
// export async function bypassOrderPayment(req: Request, res: Response) {
//   const orderId = parseInt(String(req.params.orderId), 10);
//   if (isNaN(orderId)) {
//     throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã đơn hàng không hợp lệ.' };
//   }

//   const order = await forcePayOrder(orderId);

//   return sendSuccess(
//     res,
//     { orderId: order.id, status: order.status },
//     'Bỏ qua thanh toán đơn hàng thành công (Chỉ dành cho TEST).'
//   );
// }

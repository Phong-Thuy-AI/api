import { Router } from 'express';
import { createOrder, checkOrderPaymentStatus, completeOrder, bypassOrderPayment } from '@/controllers/order.controller';
import { requireAdmin, requireUserOrAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Tạo đơn hàng mới (yêu cầu phiên hoạt động hợp lệ của User hoặc Admin)
router.post('/', requireUserOrAdmin, asyncHandler(createOrder));

// Polling kiểm tra trạng thái thanh toán đơn hàng (yêu cầu phiên hoạt động hợp lệ)
router.get('/:orderId/status', requireUserOrAdmin, asyncHandler(checkOrderPaymentStatus));

// Admin hoàn thành đơn hàng sau khi chọn SIM xong (kích hoạt referral + subscription)
router.patch('/:orderId/complete', requireAdmin, asyncHandler(completeOrder));

// Bỏ qua thanh toán đơn hàng (Chỉ dành cho TEST - sẽ gỡ khi deploy)
router.post('/:orderId/bypass-pay', requireUserOrAdmin, asyncHandler(bypassOrderPayment));

export default router;

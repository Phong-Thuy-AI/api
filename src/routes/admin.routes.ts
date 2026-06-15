import { Router } from 'express';
import { 
  setConfig, 
  getConfig, 
  triggerDailyHoroscopes,
  getOrders,
  getUsers,
  extendUserSubscription,
  forcePayAdminOrder,
  confirmSimOrder,
  setConfigsBatch,
  getAllConfigs,
  getAiModels,
  testAiConnection,
  testEmailSend,
  getEmailLogs
} from '@/controllers/admin.controller';
import { requireAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Tất cả admin routes đều yêu cầu quyền Admin
router.use(requireAdmin);

// Cấu hình hệ thống (AI key, Zalo number, v.v.)
router.post('/config', asyncHandler(setConfig));
router.post('/config/batch', asyncHandler(setConfigsBatch));
router.get('/config/all', asyncHandler(getAllConfigs));
router.get('/config/:key', asyncHandler(getConfig));

// Trigger thủ công job tạo tử vi hằng ngày
router.post('/trigger-horoscopes', asyncHandler(triggerDailyHoroscopes));

// Quản lý Đơn hàng
router.get('/orders', asyncHandler(getOrders));
router.post('/orders/:orderId/force-pay', asyncHandler(forcePayAdminOrder));
router.post('/orders/:orderId/confirm-sim', asyncHandler(confirmSimOrder));

// Quản lý Khách hàng
router.get('/users', asyncHandler(getUsers));
router.patch('/users/:userId/extend', asyncHandler(extendUserSubscription));

// Kiểm tra kết nối AI & Email
router.get('/ai/models', asyncHandler(getAiModels));
router.post('/ai/test-connection', asyncHandler(testAiConnection));
router.post('/email/test-send', asyncHandler(testEmailSend));

// Nhật ký gửi mail hằng ngày
router.get('/email-logs', asyncHandler(getEmailLogs));

export default router;

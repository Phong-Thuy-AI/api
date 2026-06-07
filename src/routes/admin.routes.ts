import { Router } from 'express';
import { setConfig, getConfig, triggerDailyHoroscopes } from '@/controllers/admin.controller';
import { requireAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Tất cả admin routes đều yêu cầu quyền Admin
router.use(requireAdmin);

// Cấu hình hệ thống (AI key, Zalo number, v.v.)
router.post('/config', asyncHandler(setConfig));
router.get('/config/:key', asyncHandler(getConfig));

// Trigger thủ công job tạo tử vi hằng ngày
router.post('/trigger-horoscopes', asyncHandler(triggerDailyHoroscopes));

export default router;

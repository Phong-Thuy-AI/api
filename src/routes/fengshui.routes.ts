import { Router } from 'express';
import { checkFengShuiSim } from '@/controllers/fengshui.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// API Check SIM phong thủy và khởi tạo session User (Không yêu cầu đăng nhập trước)
router.post('/check', asyncHandler(checkFengShuiSim));

export default router;

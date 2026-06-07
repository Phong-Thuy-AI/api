import { Router } from 'express';
import { loginAdmin, logoutAdmin, getAdminProfile, lookupUser } from '@/controllers/auth.controller';
import { requireAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Route đăng nhập Admin
router.post('/admin/login', asyncHandler(loginAdmin));

// Route đăng xuất Admin
router.post('/admin/logout', asyncHandler(logoutAdmin));

// Route kiểm tra phiên hoạt động Admin (yêu cầu token trong cookie)
router.get('/admin/me', requireAdmin, asyncHandler(getAdminProfile));

// Route tra cứu đơn hàng bằng Email + SĐT (PUBLIC — không cần đăng nhập)
router.post('/user/lookup', asyncHandler(lookupUser));

export default router;

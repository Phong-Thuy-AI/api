import { Router } from 'express';
import { 
  loginAdmin, logoutAdmin, getAdminProfile, lookupUser,
  getUserProfile, subscribeTrial, renewLogin 
} from '@/controllers/auth.controller';
import { requireAdmin, requireUser } from '@/middlewares/auth.middleware';
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

// Route lấy thông tin profile người dùng hiện tại
router.get('/user/me', requireUser, asyncHandler(getUserProfile));

// Route đăng ký dùng thử miễn phí 1 tháng
router.post('/user/subscribe-trial', requireUser, asyncHandler(subscribeTrial));

// Route tự đăng nhập từ email gia hạn
router.get('/user/renew-login', asyncHandler(renewLogin));

export default router;

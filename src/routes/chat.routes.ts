import { Router } from 'express';
import { getActiveRooms, getRoomMessages } from '@/controllers/chat.controller';
import { requireAdmin, requireUserOrAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Lấy danh sách phòng chat đang active (chỉ Admin)
router.get('/rooms/active', requireAdmin, asyncHandler(getActiveRooms));

// Lấy lịch sử tin nhắn của một phòng chat (User sở hữu hoặc Admin)
router.get('/rooms/:roomId/messages', requireUserOrAdmin, asyncHandler(getRoomMessages));

export default router;

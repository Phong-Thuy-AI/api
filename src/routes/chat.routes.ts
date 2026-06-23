import { Router } from 'express';
import { getActiveRooms, getRoomMessages, updateRoomUserEmail } from '@/controllers/chat.controller';
import { requireAdmin, requireUserOrAdmin } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Lấy danh sách phòng chat đang active (chỉ Admin)
router.get('/rooms/active', requireAdmin, asyncHandler(getActiveRooms));

// Lấy lịch sử tin nhắn của một phòng chat (User sở hữu hoặc Admin)
router.get('/rooms/:roomId/messages', requireUserOrAdmin, asyncHandler(getRoomMessages));

// Cập nhật email của khách hàng trong phòng chat (User sở hữu hoặc Admin)
router.post('/rooms/:roomId/email', requireUserOrAdmin, asyncHandler(updateRoomUserEmail));

export default router;

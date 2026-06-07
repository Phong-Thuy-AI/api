import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ChatRoom, ChatMessage, Order, User } from '@/models';
import { sendSuccess } from '@/utils/response';
import { CHAT_ROOM_ACTIVE, CHAT_ROOM_CLOSED } from '@/utils/constants';

/**
 * Lấy danh sách phòng chat đang active kèm thông tin đơn hàng và người dùng
 * GET /api/v1/chats/rooms/active
 * Yêu cầu: requireAdmin
 */
export async function getActiveRooms(req: Request, res: Response) {
  const rooms = await ChatRoom.findAll({
    where: { status: { [Op.in]: [CHAT_ROOM_ACTIVE, CHAT_ROOM_CLOSED] } },
    include: [
      {
        model: Order,
        as: 'order',
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'phone', 'menh']
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const roomsWithMetadata = await Promise.all(
    rooms.map(async (room) => {
      // Lấy tin nhắn cuối cùng trong phòng
      const lastMessage = await ChatMessage.findOne({
        where: { roomId: room.id },
        order: [['id', 'DESC']]
      });

      // Lấy tin nhắn cuối cùng do admin gửi
      const lastAdminMsg = await ChatMessage.findOne({
        where: { roomId: room.id, senderType: 'admin' },
        order: [['id', 'DESC']]
      });

      let unreadCount = 0;
      if (lastAdminMsg) {
        unreadCount = await ChatMessage.count({
          where: {
            roomId: room.id,
            id: { [Op.gt]: lastAdminMsg.id },
            senderType: { [Op.ne]: 'admin' }
          }
        });
      } else {
        unreadCount = await ChatMessage.count({
          where: {
            roomId: room.id,
            senderType: { [Op.ne]: 'admin' }
          }
        });
      }

      return {
        ...room.toJSON(),
        lastMessage,
        unreadCount
      };
    })
  );

  return sendSuccess(res, roomsWithMetadata, `Lấy danh sách ${rooms.length} phòng chat đang hoạt động thành công.`);
}

/**
 * Lấy lịch sử tin nhắn của một phòng chat
 * GET /api/v1/chats/rooms/:roomId/messages
 * Yêu cầu: requireUserOrAdmin
 */
export async function getRoomMessages(req: Request, res: Response) {
  const roomId = parseInt(String(req.params.roomId), 10);

  if (isNaN(roomId)) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Mã phòng chat không hợp lệ.'
    };
  }

  const chatRoom = await ChatRoom.findByPk(roomId, {
    include: [{ model: Order, as: 'order', attributes: ['id', 'packageType', 'userId', 'carrier', 'consultationTopic'] }]
  });

  if (!chatRoom) {
    throw {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Phòng chat không tồn tại.'
    };
  }

  // User chỉ được xem tin nhắn của phòng chat thuộc đơn hàng của mình
  if (req.user && !req.admin) {
    const order = (chatRoom as any).order as Order;
    if (!order || order.userId !== req.user.userId) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem tin nhắn phòng chat này.'
      };
    }
  }

  const messages = await ChatMessage.findAll({
    where: { roomId },
    order: [['createdAt', 'ASC']]
  });

  return sendSuccess(
    res,
    { room: chatRoom, messages },
    `Lấy ${messages.length} tin nhắn trong phòng chat thành công.`
  );
}

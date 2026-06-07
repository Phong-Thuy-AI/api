import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import cookieLib from 'cookie';
import { verifyToken } from '@/utils/jwt';
import { ChatMessage, ChatRoom, Order, User } from '@/models';
import { SENDER_ADMIN, SENDER_USER, CHAT_ROOM_ACTIVE } from '@/utils/constants';

interface SocketData {
  role: 'admin' | 'user';
  userId?: number;
  adminId?: string;
}

let io: SocketServer;

/**
 * Khởi tạo Socket.io Server và đăng ký toàn bộ events
 */
export function initSocketService(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // ────────────────────────────────────────────────────────────
  // Middleware xác thực JWT từ Cookie trước khi cho phép kết nối
  // ────────────────────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie || '';
      const cookies = cookieLib.parse(rawCookie);

      const adminToken = cookies['admin_token'];
      const userToken = cookies['user_token'];

      if (!adminToken && !userToken) {
        return next(new Error('UNAUTHORIZED: Không tìm thấy phiên đăng nhập.'));
      }

      if (adminToken) {
        const decoded = verifyToken(adminToken);
        if (decoded.role === 'admin') {
          (socket.data as SocketData).role = 'admin';
          (socket.data as SocketData).adminId = decoded.id as string;
          return next();
        }
      }

      if (userToken) {
        const decoded = verifyToken(userToken);
        (socket.data as SocketData).role = 'user';
        (socket.data as SocketData).userId = decoded.userId as number;
        return next();
      }

      return next(new Error('UNAUTHORIZED: Token không hợp lệ.'));
    } catch (err) {
      return next(new Error('UNAUTHORIZED: Xác thực phiên thất bại.'));
    }
  });

  // ────────────────────────────────────────────────────────────
  // Xử lý Events khi Client kết nối thành công
  // ────────────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const socketData = socket.data as SocketData;
    console.log(`[Socket] Connected: ${socket.id} | Role: ${socketData.role}`);

    // Admin tự động tham gia admin_room để nhận thông báo hệ thống
    if (socketData.role === 'admin') {
      socket.join('admin_room');
      console.log(`[Socket] Admin ${socketData.adminId} joined admin_room`);
    }

    // ── Event: Tham gia phòng chat đơn hàng ──────────────────
    socket.on('join_room', async (roomId: number) => {
      try {
        const chatRoom = await ChatRoom.findOne({
          where: { id: roomId, status: CHAT_ROOM_ACTIVE },
          include: [{ model: Order, as: 'order' }]
        });

        if (!chatRoom) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Phòng chat không tồn tại hoặc đã đóng.' });
          return;
        }

        // User chỉ được join phòng chat thuộc đơn hàng của chính mình
        if (socketData.role === 'user') {
          const order = (chatRoom as any).order as Order;
          if (!order || order.userId !== socketData.userId) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'Bạn không có quyền truy cập phòng chat này.' });
            return;
          }
        }

        const roomName = `room_${roomId}`;
        socket.join(roomName);
        console.log(`[Socket] ${socket.id} (${socketData.role}) joined ${roomName}`);

        socket.emit('joined_room', { roomId, message: 'Kết nối phòng chat tư vấn thành công.' });
      } catch (err) {
        console.error('[Socket] join_room error:', err);
        socket.emit('error', { code: 'INTERNAL_ERROR', message: 'Lỗi khi tham gia phòng chat.' });
      }
    });

    // ── Event: Gửi tin nhắn ──────────────────────────────────
    socket.on('send_message', async (payload: { roomId: number; message: string }) => {
      try {
        const { roomId, message } = payload;

        if (!message || !message.trim()) {
          socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Tin nhắn không được để trống.' });
          return;
        }

        const chatRoom = await ChatRoom.findOne({
          where: { id: roomId, status: CHAT_ROOM_ACTIVE },
          include: [{ model: Order, as: 'order' }]
        });
        if (!chatRoom) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Phòng chat không hợp lệ.' });
          return;
        }

        // Kiểm tra quyền sở hữu đối với User thường
        if (socketData.role === 'user') {
          const order = (chatRoom as any).order as Order;
          if (!order || order.userId !== socketData.userId) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'Bạn không có quyền gửi tin nhắn vào phòng chat này.' });
            return;
          }
        }

        const senderType = socketData.role === 'admin' ? SENDER_ADMIN : SENDER_USER;

        // Lưu tin nhắn vào Database
        const chatMessage = await ChatMessage.create({
          roomId,
          senderType,
          message: message.trim()
        });

        const messagePayload = {
          id: chatMessage.id,
          roomId,
          senderType,
          message: message.trim(),
          createdAt: chatMessage.createdAt
        };

        // Broadcast tin nhắn đến tất cả người trong phòng
        io.to(`room_${roomId}`).emit('receive_message', messagePayload);
        console.log(`[Socket] Message in room_${roomId} from ${senderType}: ${message.substring(0, 50)}`);
      } catch (err) {
        console.error('[Socket] send_message error:', err);
        socket.emit('error', { code: 'INTERNAL_ERROR', message: 'Lỗi khi gửi tin nhắn.' });
      }
    });

    // ── Event: Disconnect ─────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id} | Role: ${socketData.role}`);
    });
  });

  console.log('[Socket] Socket.io Service initialized successfully.');
  return io;
}

/**
 * Lấy instance Socket.io Server hiện tại
 */
export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io chưa được khởi tạo. Hãy gọi initSocketService() trước.');
  return io;
}

/**
 * Phát thông báo realtime đến room 'admin_room' khi có phòng chat mới được kích hoạt
 */
export async function notifyAdminNewChatRoom(chatRoom: ChatRoom): Promise<void> {
  if (!io) return;
  try {
    const fullRoom = await ChatRoom.findByPk(chatRoom.id, {
      include: [
        {
          model: Order,
          as: 'order',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });
    io.to('admin_room').emit('new_chat_room', fullRoom);
    console.log(`[Socket] Notified admin_room: New chat room #${chatRoom.id} is active.`);
  } catch (err) {
    console.error('[Socket] notifyAdminNewChatRoom error:', err);
  }
}

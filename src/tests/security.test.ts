import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { Request, Response } from 'express';
import axios from 'axios';
import { User, Order, Hexagram, ChatRoom } from '@/models';
import { checkFengShuiSim } from '@/controllers/fengshui.controller';
import { createOrder, checkOrderPaymentStatus } from '@/controllers/order.controller';
import { getRoomMessages, updateRoomUserEmail } from '@/controllers/chat.controller';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Kiểm thử bảo mật & nghiệp vụ - Security & Ownership Controls', () => {
  let userA: any;
  let userB: any;
  let orderA: any;
  let chatRoomA: any;

  beforeAll(async () => {
    // Mock Axios get để giải quyết long polling ngay lập tức
    mockedAxios.get.mockResolvedValue({
      data: {
        transactions: []
      }
    } as any);

    // Đảm bảo có ít nhất 3 quẻ dịch để chạy test check phong thủy không bị lỗi DB
    await Hexagram.upsert({ id: 16, name: 'Quẻ Cát', classification: 'CÁT', originalText: 'test', cleanedText: 'Vận Cát' });
    await Hexagram.upsert({ id: 25, name: 'Quẻ Trung', classification: 'BÁN CÁT', originalText: 'test', cleanedText: 'Vận Bán Cát' });
    await Hexagram.upsert({ id: 34, name: 'Quẻ Hung', classification: 'HUNG', originalText: 'test', cleanedText: 'Vận Hung' });
    await Hexagram.upsert({ id: 80, name: 'Quẻ 80', classification: 'CÁT', originalText: 'test', cleanedText: 'Vận 80' });

    // Tạo các user thử nghiệm
    userA = await User.create({
      name: 'User A',
      email: 'usera@example.com',
      phone: '0912345678',
      dob: new Date('1990-01-01'),
      tob: '12:00',
      menh: 'Mộc'
    });

    userB = await User.create({
      name: 'User B',
      email: 'userb@example.com',
      phone: '0987654321',
      dob: new Date('1992-05-05'),
      tob: '06:00',
      menh: 'Thổ'
    });

    // Tạo order cho userA
    orderA = await Order.create({
      userId: userA.id,
      packageType: '200k',
      amount: 200000,
      paymentCode: 'TOPUPTESTORDERA',
      status: 'pending'
    });

    // Tạo ChatRoom liên kết với orderA để test quyền truy cập tin nhắn
    chatRoomA = await ChatRoom.create({
      orderId: orderA.id,
      status: 'active'
    });
  });

  afterAll(async () => {
    if (chatRoomA) await chatRoomA.destroy();
    if (orderA) await orderA.destroy();
    if (userA) await userA.destroy();
    if (userB) await userB.destroy();
  });

  describe('API Check SIM Phong Thủy - checkFengShuiSim()', () => {
    test('Validate dữ liệu đầu vào không hợp lệ', async () => {
      const mockReq = {
        body: {
          name: 'Test',
          email: 'invalid-email', // Sai format email
          phone: '123', // Thiếu ký tự
          dob: '1995-05-05',
          tob: '08:00',
          usedLessThan6Months: true,
          focusArea: 'Không Hợp Lệ'
        }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(checkFengShuiSim(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR'
        })
      );
    });

    test('Chạy thành công, tạo User mới và thiết lập cookie user_token', async () => {
      const mockReq = {
        body: {
          name: 'Nguyen Van Test',
          email: 'newuser@example.com',
          phone: '0912123456',
          dob: '1990-05-15', // 15/05 -> mệnh Hỏa
          tob: '10:00',
          usedLessThan6Months: false,
          focusArea: 'Công việc'
        }
      } as unknown as Request;

      const cookies: Record<string, any> = {};
      const mockRes = {
        cookie: (jest.fn() as any).mockImplementation((name: any, val: any) => {
          cookies[name] = val;
          return mockRes;
        }),
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const result = await checkFengShuiSim(mockReq, mockRes);
      expect(result).toBeDefined();

      // Kiểm tra xem user có được tạo hay không
      const createdUser = await User.findOne({ where: { email: 'newuser@example.com' } });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.referralCode).toBeNull();

      // Cookie user_token được thiết lập
      expect(cookies['user_token']).toBeDefined();

      // Dọn dẹp
      if (createdUser) await createdUser.destroy();
    });
  });

  describe('API Tạo đơn hàng - createOrder() Ownership', () => {
    test('User thường không thể tạo order hộ cho user khác', async () => {
      const mockReq = {
        user: { userId: userA.id, role: 'user' },
        body: {
          packageType: '200k',
          carrier: 'Viettel',
          userId: userB.id // Cố tình truyền userId của người khác
        }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(createOrder(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền tạo đơn hàng cho người dùng khác.'
        })
      );
    });

    test('Admin có thể tạo order cho bất kỳ user nào nếu user đó tồn tại', async () => {
      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        body: {
          packageType: '200k',
          carrier: 'Viettel',
          userId: userB.id
        }
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockImplementation(() => mockRes),
        json: jest.fn().mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await createOrder(mockReq, mockRes);
      expect(response.success).toBe(true);

      // Dọn dẹp
      await Order.destroy({ where: { id: response.data.order.id } });
    });

    test('Admin tạo order cho user không tồn tại sẽ bị lỗi 404', async () => {
      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        body: {
          packageType: '200k',
          carrier: 'Viettel',
          userId: 999999 // User không tồn tại
        }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(createOrder(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Không tìm thấy người dùng được yêu cầu tạo đơn hàng.'
        })
      );
    });
  });

  describe('API Kiểm tra thanh toán - checkOrderPaymentStatus() Ownership', () => {
    test('User không có quyền xem thông tin order của user khác', async () => {
      const mockReq = {
        user: { userId: userB.id, role: 'user' }, // User B cố xem order A (của User A)
        params: { orderId: String(orderA.id) }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(checkOrderPaymentStatus(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập thông tin đơn hàng này.'
        })
      );
    });

    test('Admin có quyền xem thông tin order của bất kỳ ai', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          transactions: [
            {
              transactionID: 99999111,
              description: 'Thanh toan TOPUPTESTORDERA',
              amount: 200000,
              transactionDate: '2026-06-02 20:00:00',
              type: 'IN'
            }
          ]
        }
      } as any);

      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        params: { orderId: String(orderA.id) }
      } as unknown as Request;

      const mockRes = {
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await checkOrderPaymentStatus(mockReq, mockRes);
      expect(response.success).toBe(true);
    });
  });

  describe('API Lịch sử tin nhắn - getRoomMessages() Ownership', () => {
    test('User B không thể đọc tin nhắn phòng chat thuộc order của User A', async () => {
      const mockReq = {
        user: { userId: userB.id, role: 'user' }, // User B cố đọc room của User A
        params: { roomId: String(chatRoomA.id) }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(getRoomMessages(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền xem tin nhắn phòng chat này.'
        })
      );
    });

    test('User A có thể đọc tin nhắn phòng chat của chính mình', async () => {
      const mockReq = {
        user: { userId: userA.id, role: 'user' },
        params: { roomId: String(chatRoomA.id) }
      } as unknown as Request;

      const mockRes = {
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await getRoomMessages(mockReq, mockRes);
      expect(response.success).toBe(true);
      expect(response.data.room.id).toBe(chatRoomA.id);
    });

    test('Admin có thể đọc tin nhắn của bất kỳ phòng chat nào', async () => {
      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        params: { roomId: String(chatRoomA.id) }
      } as unknown as Request;

      const mockRes = {
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await getRoomMessages(mockReq, mockRes);
      expect(response.success).toBe(true);
    });
  });

  describe('API Cập nhật Email phòng chat - updateRoomUserEmail() Ownership & Validation', () => {
    test('User A có thể cập nhật email phòng chat của chính mình', async () => {
      const mockReq = {
        user: { userId: userA.id, role: 'user' },
        params: { roomId: String(chatRoomA.id) },
        body: { email: 'usera-new@example.com' }
      } as unknown as Request;

      const mockRes = {
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await updateRoomUserEmail(mockReq, mockRes);
      expect(response.success).toBe(true);
      expect(response.data.email).toBe('usera-new@example.com');

      const updatedUser = await User.findByPk(userA.id);
      expect(updatedUser?.email).toBe('usera-new@example.com');
    });

    test('User B KHÔNG thể cập nhật email phòng chat của User A (trả về 403 Forbidden)', async () => {
      const mockReq = {
        user: { userId: userB.id, role: 'user' },
        params: { roomId: String(chatRoomA.id) },
        body: { email: 'userb-hack@example.com' }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(updateRoomUserEmail(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền cập nhật thông tin phòng chat này.'
        })
      );
    });

    test('Admin có thể cập nhật email của bất kỳ phòng chat nào', async () => {
      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        params: { roomId: String(chatRoomA.id) },
        body: { email: 'usera-admin-updated@example.com' }
      } as unknown as Request;

      const mockRes = {
        status: (jest.fn() as any).mockImplementation(() => mockRes),
        json: (jest.fn() as any).mockImplementation((data: any) => data)
      } as unknown as Response;

      const response: any = await updateRoomUserEmail(mockReq, mockRes);
      expect(response.success).toBe(true);
      expect(response.data.email).toBe('usera-admin-updated@example.com');
    });

    test('Trả về lỗi validation khi định dạng email sai', async () => {
      const mockReq = {
        admin: { id: 'admin', role: 'admin' },
        params: { roomId: String(chatRoomA.id) },
        body: { email: 'invalidemail' }
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(updateRoomUserEmail(mockReq, mockRes)).rejects.toEqual(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Địa chỉ email không đúng định dạng.'
        })
      );
    });
  });
});

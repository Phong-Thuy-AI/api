import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { User, Order, ChatRoom } from '@/models';
import { checkAndUpdateOrderStatus, generatePaymentCode, generateQrUrl } from '@/services/payment.service';

// Mock thư viện Axios để giả lập API Web2M
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Kiểm thử Dịch vụ Thanh toán - services/payment.service.ts', () => {
  let testUser: any;
  let testOrder200k: any;
  let testOrder500k: any;

  beforeAll(async () => {
    try {
      // Dọn dẹp dữ liệu cũ nếu bị kẹt từ các lần chạy trước
      const oldUser = await User.findOne({ where: { email: 'testpayment@example.com' } });
      if (oldUser) {
        const oldOrders = await Order.findAll({ where: { userId: oldUser.id } });
        for (const o of oldOrders) {
          await ChatRoom.destroy({ where: { orderId: o.id } });
          await o.destroy();
        }
        await oldUser.destroy();
      }

      // Khởi tạo một User test trong DB thật để làm khoá ngoại cho Order
      testUser = await User.create({
        name: 'Khách Hàng Test Thanh Toán',
        email: 'testpayment@example.com',
        phone: '0987654321',
        dob: new Date('1995-05-15'),
        tob: '08:00',
        menh: 'Hỏa'
      });
    } catch (err: any) {
      console.error('LỖI TRONG BEFOREALL KHI TẠO USER:', err);
      throw err;
    }
  });

  afterAll(async () => {
    // Dọn sạch dữ liệu test trong database sau khi chạy xong kiểm thử
    if (testOrder200k) {
      await ChatRoom.destroy({ where: { orderId: testOrder200k.id } });
      await testOrder200k.destroy();
    }
    if (testOrder500k) {
      await testOrder500k.destroy();
    }
    if (testUser) {
      await testUser.destroy();
    }
  });

  test('generatePaymentCode - Tạo mã thanh toán dạng TOPUP không trùng lặp', async () => {
    const code = await generatePaymentCode();
    expect(code).toBeDefined();
    expect(code.startsWith('TOPUP')).toBe(true);
    expect(code.length).toBe(21); // Định dạng: TOPUP + YYYYMMDD (8 số) + RANDOM (8 ký tự hex từ 4 bytes)
  });

  test('generateQrUrl - Sinh URL ảnh QR VietQR đúng định dạng chứa số tiền và nội dung chuyển khoản', () => {
    const amount = 200000;
    const code = 'TOPUP20260601ABCD';
    const qrUrl = generateQrUrl(amount, code);
    
    expect(qrUrl).toBeDefined();
    expect(qrUrl.includes(String(amount))).toBe(true);
    expect(qrUrl.includes(code)).toBe(true);
  });

  test('checkAndUpdateOrderStatus - Đối soát thành công gói 200k & Tự động tạo ChatRoom', async () => {
    // 1. Tạo đơn hàng 200k giả ở trạng thái pending
    const paymentCode = await generatePaymentCode();
    testOrder200k = await Order.create({
      userId: testUser.id,
      packageType: '200k',
      amount: 200000,
      paymentCode,
      status: 'pending'
    });

    // 2. Giả lập phản hồi giao dịch ngân hàng từ Web2M khớp mã nạp và số tiền
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        transactions: [
          {
            transactionID: 99912345,
            description: `Chuyển khoản nạp tiền ${paymentCode} cải vận cát tường`,
            amount: 200000,
            transactionDate: '2026-06-01 20:00:00',
            type: 'IN'
          }
        ]
      }
    } as any);

    // 3. Chạy hàm đối soát tự động
    const result = await checkAndUpdateOrderStatus(testOrder200k.id);

    expect(result.paid).toBe(true);
    expect(result.order.status).toBe('paid');
    expect(result.order.web2mTransactionId).toBe('99912345');
    expect(result.order.paidAt).toBeDefined();

    // 4. Xác nhận ChatRoom được khởi tạo tự động cho gói 200k
    const chatRoom = await ChatRoom.findOne({ where: { orderId: testOrder200k.id } });
    expect(chatRoom).toBeDefined();
    expect(chatRoom?.status).toBe('active');
  });

  test('checkAndUpdateOrderStatus - Đối soát thành công gói 500k (Không tự động tạo ChatRoom)', async () => {
    // 1. Tạo đơn hàng 500k
    const paymentCode = await generatePaymentCode();
    testOrder500k = await Order.create({
      userId: testUser.id,
      packageType: '500k',
      amount: 500000,
      paymentCode,
      status: 'pending'
    });

    // 2. Giả lập Web2M trả về giao dịch khớp
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        transactions: [
          {
            transactionID: 99912346,
            description: `Nạp tiền ${paymentCode}`,
            amount: 500000,
            transactionDate: '2026-06-01 20:05:00',
            type: 'IN'
          }
        ]
      }
    } as any);

    // 3. Đối soát
    const result = await checkAndUpdateOrderStatus(testOrder500k.id);

    expect(result.paid).toBe(true);
    expect(result.order.status).toBe('paid');

    // 4. Xác nhận KHÔNG có ChatRoom nào được tạo (vì gói 500k chuyển hướng trực tiếp qua Zalo)
    const chatRoom = await ChatRoom.findOne({ where: { orderId: testOrder500k.id } });
    expect(chatRoom).toBeNull();
  });

  test('checkAndUpdateOrderStatus - Tự động huỷ và chuyển đơn hàng sang expired sau 10 phút', async () => {
    const paymentCode = await generatePaymentCode();
    // Tạo đơn hàng
    const expiredOrder = await Order.create({
      userId: testUser.id,
      packageType: '200k',
      amount: 200000,
      paymentCode,
      status: 'pending'
    });

    // Ép lùi ngày tạo về 11 phút trước để kích hoạt hết hạn
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);
    await Order.update(
      { createdAt: elevenMinutesAgo } as any,
      { where: { id: expiredOrder.id }, silent: true }
    );

    // Gọi đối soát
    const result = await checkAndUpdateOrderStatus(expiredOrder.id);

    expect(result.paid).toBe(false);
    expect(result.order.status).toBe('expired');

    await expiredOrder.destroy();
  });
});

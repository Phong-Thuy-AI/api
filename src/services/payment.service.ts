import axios from 'axios';
import { generateTopupCode } from '@/utils/generateCode';
import { Order, ChatRoom, ChatMessage, User, sequelize } from '@/models';
import { notifyAdminNewChatRoom } from '@/services/socket.service';
import { SENDER_SYSTEM } from '@/utils/constants';

const QR_TTL_MS = 10 * 60 * 1000;

export interface Web2MTransaction {
  transactionID: number;
  description: string;
  amount: number;
  transactionDate: string;
  type: 'IN' | 'OUT';
}

export async function generatePaymentCode(): Promise<string> {
  let code = generateTopupCode();
  let exists = await Order.findOne({ where: { paymentCode: code } });
  while (exists) {
    code = generateTopupCode();
    exists = await Order.findOne({ where: { paymentCode: code } });
  }
  return code;
}

export function generateQrUrl(amount: number, paymentCode: string): string {
  const apiGetQr = process.env.WEB2M_API_GET_QR || 'https://api.web2m.com/quicklink';
  const bankName = process.env.WEB2M_BANK_NAME || 'MBBank';
  const bankNumber = process.env.WEB2M_BANK_NUMBER || '123456789';
  const accountHolder = process.env.WEB2M_ACCOUNT_HOLDER || '';
  const isMask = process.env.WEB2M_IS_MASK || 'false';
  const bg = process.env.WEB2M_BANK_BACKGROUND || 'default';

  const params = new URLSearchParams({ amount: String(amount), memo: paymentCode, is_mask: isMask, bg });
  return `${apiGetQr}/${bankName}/${bankNumber}/${encodeURIComponent(accountHolder)}?${params.toString()}`;
}

export async function fetchWeb2MTransactions(): Promise<Web2MTransaction[]> {
  const apiGetTransaction = process.env.WEB2M_API_GET_TRANSACTION || 'https://api.web2m.com/api/getTransaction';
  const bankPassword = process.env.WEB2M_BANK_PASSWORD || '';
  const bankNumber = process.env.WEB2M_BANK_NUMBER || '';
  const bankToken = process.env.WEB2M_BANK_TOKEN || '';
  const url = `${apiGetTransaction}/${bankPassword}/${bankNumber}/${bankToken}`;
  try {
    const response = await axios.get<{ transactions?: Web2MTransaction[]; error?: string }>(url, { timeout: 10000 });
    console.log("response.data11111111111111", response.data);
    return response.data.transactions || [];
  } catch (error) {
    console.log("url11111111111111", url);
    console.warn('Web2M transaction fetch failed:', error);
    return [];
  }
}

/**
 * Tạo system message chứa thông tin khách + gói khi ChatRoom được mở.
 * Tin nhắn này giúp admin có đủ context ngay khi mở phòng chat.
 */
async function sendChatRoomSystemMessage(chatRoomId: number, order: Order): Promise<void> {
  try {
    const user = await User.findByPk(order.userId);
    if (!user) return;

    let scoreInfo = '';
    if (user.lastCheckResult) {
      try {
        const result = JSON.parse(user.lastCheckResult);
        scoreInfo = `📊 Điểm SIM: ${result.totalScore}/100
• Ngũ hành: ${result.nguHanh?.score}/50 — ${result.nguHanh?.rating}
• Vận quẻ: ${result.vanQue?.score}/50 — ${result.vanQue?.rating}`;
      } catch { /* ignore parse error */ }
    }

    const packageLabel = order.packageType === '200k'
      ? '💬 Gói Đổi SIM Phong Thủy (200.000đ)'
      : '🌟 Gói Tư Vấn Chuyên Sâu (500.000đ)';

    const metaLine = order.packageType === '200k' && order.carrier
      ? `📡 Nhà mạng: ${order.carrier}`
      : order.packageType === '500k' && order.consultationTopic
        ? `💡 Vấn đề tư vấn: ${order.consultationTopic}`
        : '';

    const referralLine = user.referredByCode
      ? `🤝 Giới thiệu bởi mã: ${user.referredByCode}`
      : '';

    const dobStr = user.dob ? new Date(user.dob).toLocaleDateString('vi-VN') : '';

    const message = [
      '📋 THÔNG TIN TƯ VẤN',
      '━━━━━━━━━━━━━━━━━━',
      `👤 Tên: ${user.name}`,
      `📱 SIM cũ cần đổi: ${user.phone}`,
      `🗓 Ngày sinh: ${dobStr} | ⏰ Giờ sinh: ${user.tob}`,
      `⚡ Mệnh: ${user.menh} | 🎯 Cải vận: ${user.focusArea || '—'}`,
      '━━━━━━━━━━━━━━━━━━',
      `📦 Gói: ${packageLabel}`,
      metaLine,
      '━━━━━━━━━━━━━━━━━━',
      scoreInfo,
      referralLine,
    ].filter(Boolean).join('\n');

    await ChatMessage.create({
      roomId: chatRoomId,
      senderType: SENDER_SYSTEM as 'system',
      message
    });

    console.log(`[Payment] System message sent to room #${chatRoomId}`);
  } catch (err) {
    console.error('[Payment] sendChatRoomSystemMessage error:', err);
  }
}

export async function checkAndUpdateOrderStatus(orderId: number): Promise<{ paid: boolean; order: Order }> {
  const order = await Order.findByPk(orderId);
  if (!order) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Đơn hàng không tồn tại.' };
  }

  if (order.status === 'paid' || order.status === 'completed') {
    return { paid: true, order };
  }

  if (order.status === 'expired') {
    return { paid: false, order };
  }

  const qrAge = Date.now() - new Date(order.createdAt).getTime();
  if (qrAge > QR_TTL_MS) {
    order.status = 'expired';
    await order.save();
    return { paid: false, order };
  }

  const transactions = await fetchWeb2MTransactions();

  const match = transactions.find(tx =>
    tx.type === 'IN' &&
    tx.description.toUpperCase().includes(order.paymentCode.toUpperCase()) &&
    Number(tx.amount) >= Number(order.amount)
  );

  if (match) {
    const t = await sequelize.transaction();
    try {
      order.status = 'paid';
      order.web2mTransactionId = String(match.transactionID);
      order.paidAt = new Date();
      await order.save({ transaction: t });

      const orderWithUser = await Order.findByPk(order.id, {
        include: [{ model: User, as: 'user' }],
        transaction: t
      });
      const user = (orderWithUser as any)?.user as User | null;

      if (order.packageType === '365k') {
        if (user) {
          const creditDays = 365;
          const now = new Date();
          const currentExpiry = user.horoscopeExpiresAt;
          user.horoscopeExpiresAt = currentExpiry && currentExpiry > now
            ? new Date(currentExpiry.getTime() + creditDays * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000);
          user.expiryEmailSent = false;
          await user.save({ transaction: t });
        }
        order.status = 'completed';
        order.completedAt = new Date();
        await order.save({ transaction: t });
      } else {
        const sourceType = user?.referredByCode ? 'referral' : 'direct';
        const [chatRoom] = await ChatRoom.findOrCreate({
          where: { orderId: order.id },
          defaults: { orderId: order.id, status: 'active', sourceType },
          transaction: t
        });

        t.afterCommit(async () => {
          await sendChatRoomSystemMessage(chatRoom.id, order);
          notifyAdminNewChatRoom(chatRoom);
        });
      }

      await t.commit();
      return { paid: true, order };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  return { paid: false, order };
}

export async function pollPaymentStatus(orderId: number, timeoutMs = 20000): Promise<{ paid: boolean; order: Order }> {
  const deadline = Date.now() + timeoutMs;
  const interval = 3000;

  while (Date.now() < deadline) {
    const result = await checkAndUpdateOrderStatus(orderId);
    if (result.paid || result.order.status === 'expired') {
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const order = await Order.findByPk(orderId);
  return { paid: false, order: order! };
}

export async function forcePayOrder(orderId: number): Promise<Order> {
  const order = await Order.findByPk(orderId);
  if (!order) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Đơn hàng không tồn tại.' };
  }
  if (order.status !== 'pending') {
    return order;
  }

  const t = await sequelize.transaction();
  try {
    order.status = 'paid';
    order.web2mTransactionId = 'MANUAL_' + Date.now();
    order.paidAt = new Date();
    await order.save({ transaction: t });

    const orderWithUser = await Order.findByPk(order.id, {
      include: [{ model: User, as: 'user' }],
      transaction: t
    });
    const user = (orderWithUser as any)?.user as User | null;

    if (order.packageType === '365k') {
      if (user) {
        const creditDays = 365;
        const now = new Date();
        const currentExpiry = user.horoscopeExpiresAt;
        user.horoscopeExpiresAt = currentExpiry && currentExpiry > now
          ? new Date(currentExpiry.getTime() + creditDays * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000);
        user.expiryEmailSent = false;
        await user.save({ transaction: t });
      }
      order.status = 'completed';
      order.completedAt = new Date();
      await order.save({ transaction: t });
    } else {
      const sourceType = user?.referredByCode ? 'referral' : 'direct';
      const [chatRoom] = await ChatRoom.findOrCreate({
        where: { orderId: order.id },
        defaults: { orderId: order.id, status: 'active', sourceType },
        transaction: t
      });

      t.afterCommit(async () => {
        await sendChatRoomSystemMessage(chatRoom.id, order);
        notifyAdminNewChatRoom(chatRoom);
      });
    }

    await t.commit();
    return order;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

export async function checkAllPendingOrders(): Promise<void> {
  const pendingOrders = await Order.findAll({ where: { status: 'pending' } });
  if (pendingOrders.length === 0) return;

  const now = Date.now();
  const validPendingOrders: Order[] = [];

  for (const order of pendingOrders) {
    const qrAge = now - new Date(order.createdAt).getTime();
    if (qrAge > QR_TTL_MS) {
      order.status = 'expired';
      await order.save();
      console.log(`[Payment Sweeper] Đơn hàng #${order.id} đã hết hạn.`);
    } else {
      validPendingOrders.push(order);
    }
  }

  if (validPendingOrders.length === 0) return;

  const transactions = await fetchWeb2MTransactions();
  if (transactions.length === 0) return;

  for (const order of validPendingOrders) {
    const match = transactions.find(tx =>
      tx.type === 'IN' &&
      tx.description.toUpperCase().includes(order.paymentCode.toUpperCase()) &&
      Number(tx.amount) >= Number(order.amount)
    );

    if (match) {
      const t = await sequelize.transaction();
      try {
        order.status = 'paid';
        order.web2mTransactionId = String(match.transactionID);
        order.paidAt = new Date();
        await order.save({ transaction: t });

        const orderWithUser = await Order.findByPk(order.id, {
          include: [{ model: User, as: 'user' }],
          transaction: t
        });
        const user = (orderWithUser as any)?.user as User | null;

        if (order.packageType === '365k') {
          if (user) {
            const creditDays = 365;
            const now = new Date();
            const currentExpiry = user.horoscopeExpiresAt;
            user.horoscopeExpiresAt = currentExpiry && currentExpiry > now
              ? new Date(currentExpiry.getTime() + creditDays * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000);
            user.expiryEmailSent = false;
            await user.save({ transaction: t });
          }
          order.status = 'completed';
          order.completedAt = new Date();
          await order.save({ transaction: t });
          t.afterCommit(async () => {
            console.log(`[Payment Sweeper] Đơn hàng gia hạn #${order.id} đã hoàn thành tự động qua background sweeper.`);
          });
        } else {
          const sourceType = user?.referredByCode ? 'referral' : 'direct';
          const [chatRoom] = await ChatRoom.findOrCreate({
            where: { orderId: order.id },
            defaults: { orderId: order.id, status: 'active', sourceType },
            transaction: t
          });

          t.afterCommit(async () => {
            await sendChatRoomSystemMessage(chatRoom.id, order);
            notifyAdminNewChatRoom(chatRoom);
            console.log(`[Payment Sweeper] Đơn hàng #${order.id} đối soát thành công qua background sweeper.`);
          });
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        console.error(`[Payment Sweeper] Lỗi xử lý đơn hàng #${order.id}:`, err);
      }
    }
  }
}

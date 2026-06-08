import { Request, Response } from 'express';
import { Op } from 'sequelize';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { SystemConfig, Order, User, DailyEmailLog } from '@/models';
import { sendSuccess } from '@/utils/response';
import { generateAllDailyHoroscopes, sendAllDailyEmails } from '@/services/cron.service';
import { forcePayOrder } from '@/services/payment.service';

/**
 * Lưu hoặc cập nhật một giá trị cấu hình hệ thống
 * POST /api/v1/admin/config
 * Body: { key: string, value: string }
 */
export async function setConfig(req: Request, res: Response) {
  const { key, value } = req.body;

  if (!key || value === undefined || value === null) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Trường key và value là bắt buộc.'
    };
  }

  const allowedKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ZALO_ADMIN_NUMBER'];
  if (!allowedKeys.includes(key)) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Key không hợp lệ. Chỉ chấp nhận: ${allowedKeys.join(', ')}.`
    };
  }

  await SystemConfig.upsert({ key, value: String(value) });
  return sendSuccess(res, { key }, 'Cấu hình hệ thống đã được cập nhật thành công.');
}

/**
 * Lấy giá trị một cấu hình hệ thống
 * GET /api/v1/admin/config/:key
 */
export async function getConfig(req: Request, res: Response) {
  const key = String(req.params.key);

  const config = await SystemConfig.findByPk(key);
  if (!config) {
    throw {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Không tìm thấy cấu hình với key này.'
    };
  }

  return sendSuccess(res, { key: config.key, value: config.value }, 'Lấy cấu hình thành công.');
}

/**
 * Kích hoạt thủ công job tạo tử vi và gửi email (để admin test hoặc chạy bù)
 * POST /api/v1/admin/trigger-horoscopes
 */
export async function triggerDailyHoroscopes(req: Request, res: Response) {
  // Chạy ngầm, không chờ để tránh timeout HTTP
  generateAllDailyHoroscopes()
    .then(() => sendAllDailyEmails())
    .catch(err => console.error('[Admin] triggerDailyHoroscopes error:', err));

  return sendSuccess(res, null, 'Đã kích hoạt job tạo tử vi hằng ngày. Quá trình đang chạy ngầm.');
}

/**
 * Lấy danh sách tất cả đơn hàng kèm thông tin người dùng
 * GET /api/v1/admin/orders
 * Query: status, search
 */
export async function getOrders(req: Request, res: Response) {
  const { status, search } = req.query;
  const whereClause: any = {};

  if (status && typeof status === 'string' && status !== 'all') {
    whereClause.status = status;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const searchVal = search.trim();
    whereClause[Op.or] = [
      { paymentCode: { [Op.like]: `%${searchVal}%` } },
      { '$user.name$': { [Op.like]: `%${searchVal}%` } },
      { '$user.phone$': { [Op.like]: `%${searchVal}%` } }
    ];
  }

  const orders = await Order.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'phone', 'menh']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  return sendSuccess(res, orders, `Lấy danh sách ${orders.length} đơn hàng thành công.`);
}

/**
 * Lấy danh sách tất cả khách hàng
 * GET /api/v1/admin/users
 * Query: search
 */
export async function getUsers(req: Request, res: Response) {
  const { search } = req.query;
  const whereClause: any = {};

  if (search && typeof search === 'string' && search.trim()) {
    const searchVal = search.trim();
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${searchVal}%` } },
      { phone: { [Op.like]: `%${searchVal}%` } },
      { email: { [Op.like]: `%${searchVal}%` } }
    ];
  }

  const users = await User.findAll({
    where: whereClause,
    order: [['createdAt', 'DESC']]
  });

  return sendSuccess(res, users, `Lấy danh sách ${users.length} khách hàng thành công.`);
}

/**
 * Gia hạn thủ công 30 ngày xem tử vi cho khách hàng
 * PATCH /api/v1/admin/users/:userId/extend
 */
export async function extendUserSubscription(req: Request, res: Response) {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã khách hàng không hợp lệ.' };
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Khách hàng không tồn tại.' };
  }

  const creditDays = 30; // Tặng 30 ngày
  const now = new Date();
  const currentExpiry = user.horoscopeExpiresAt;

  user.horoscopeExpiresAt = currentExpiry && currentExpiry > now
    ? new Date(currentExpiry.getTime() + creditDays * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000);

  await user.save();

  return sendSuccess(
    res,
    { userId: user.id, horoscopeExpiresAt: user.horoscopeExpiresAt },
    `Gia hạn thành công 30 ngày nhận tử vi hằng ngày cho khách hàng ${user.name}.`
  );
}

/**
 * Duyệt thanh toán đơn hàng thủ công
 * POST /api/v1/admin/orders/:orderId/force-pay
 */
export async function forcePayAdminOrder(req: Request, res: Response) {
  const orderId = parseInt(String(req.params.orderId), 10);
  if (isNaN(orderId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã đơn hàng không hợp lệ.' };
  }

  const order = await forcePayOrder(orderId);
  return sendSuccess(res, order, 'Duyệt thanh toán đơn hàng thủ công thành công.');
}

/**
 * Lưu hàng loạt cấu hình hệ thống
 * POST /api/v1/admin/config/batch
 */
export async function setConfigsBatch(req: Request, res: Response) {
  const { configs } = req.body;
  if (!configs || typeof configs !== 'object') {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Cấu hình gửi lên không hợp lệ.' };
  }

  const allowedKeys = [
    'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ZALO_ADMIN_NUMBER',
    'AI_PROVIDER', 'AI_MODEL',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'
  ];

  for (const [key, value] of Object.entries(configs)) {
    if (allowedKeys.includes(key)) {
      const valStr = String(value);
      if (valStr.startsWith('****')) {
        continue;
      }
      await SystemConfig.upsert({ key, value: valStr });
    }
  }
  return sendSuccess(res, null, 'Đã cập nhật các cấu hình hệ thống thành công.');
}

export async function getAllConfigs(req: Request, res: Response) {
  const configs = await SystemConfig.findAll();
  const result: Record<string, string> = {};

  for (const c of configs) {
    if (c.value && c.value.startsWith('****')) {
      await SystemConfig.destroy({ where: { key: c.key } });
      continue;
    }
    result[c.key] = c.value;
  }

  const keys = [
    'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ZALO_ADMIN_NUMBER',
    'AI_PROVIDER', 'AI_MODEL',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'
  ];

  keys.forEach(k => {
    if (result[k] === undefined || result[k] === '') {
      result[k] = process.env[k] || '';
    }
  });

  return sendSuccess(res, result, 'Lấy toàn bộ cấu hình hệ thống thành công.');
}


/**
 * Lấy danh sách các model khả dụng từ nhà cung cấp AI
 * GET /api/v1/admin/ai/models
 */
export async function getAiModels(req: Request, res: Response) {
  const provider = String(req.query.provider || 'gemini');
  let apiKey = String(req.query.apiKey || '');

  if (!apiKey || apiKey.startsWith('****')) {
    const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
    const dbConfig = await SystemConfig.findByPk(keyName);
    apiKey = dbConfig?.value || process.env[keyName] || '';
  }

  if (!apiKey) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: `Thiếu API Key cho nhà cung cấp ${provider}.` };
  }

  try {
    if (provider === 'openai') {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000
      });
      const models = (response.data.data || []).map((m: any) => m.id);
      return sendSuccess(res, models, 'Lấy danh sách model OpenAI thành công.');
    } else {
      const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        timeout: 10000
      });
      const models = (response.data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
      return sendSuccess(res, models, 'Lấy danh sách model Gemini thành công.');
    }
  } catch (err: any) {
    console.error('[Admin AI Config] Fetch models error:', err.message);
    throw {
      statusCode: 500,
      code: 'AI_PROVIDER_ERROR',
      message: `Không thể kết nối đến ${provider}. Vui lòng kiểm tra lại API Key.`
    };
  }
}

/**
 * Kiểm tra kết nối AI
 * POST /api/v1/admin/ai/test-connection
 */
export async function testAiConnection(req: Request, res: Response) {
  const { provider, apiKey, model } = req.body;
  let key = String(apiKey || '');

  if (!key || key.startsWith('****')) {
    const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
    const dbConfig = await SystemConfig.findByPk(keyName);
    key = dbConfig?.value || process.env[keyName] || '';
  }

  if (!key) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: `Thiếu API Key cho nhà cung cấp ${provider}.` };
  }

  const prompt = 'Hãy trả lời ngắn gọn từ "pong" (không viết gì thêm).';
  const targetModel = model || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

  try {
    if (provider === 'openai') {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: targetModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        timeout: 15000
      });
      const answer = response.data.choices?.[0]?.message?.content?.trim() || '';
      return sendSuccess(res, { answer }, 'Kết nối đến OpenAI thành công.');
    } else {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 10 }
        },
        { timeout: 15000 }
      );
      const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return sendSuccess(res, { answer }, 'Kết nối đến Gemini thành công.');
    }
  } catch (err: any) {
    console.error('[Admin AI Config] Test connection error:', err.message);
    throw {
      statusCode: 500,
      code: 'AI_PROVIDER_ERROR',
      message: `Lỗi kết nối AI: ${err.response?.data?.error?.message || err.message}`
    };
  }
}

/**
 * Kiểm tra gửi thử email SMTP
 * POST /api/v1/admin/email/test-send
 */
export async function testEmailSend(req: Request, res: Response) {
  const { host, port, user, pass, from, toEmail } = req.body;

  let smtpHost = host;
  let smtpPort = port;
  let smtpUser = user;
  let smtpPass = pass;
  let emailFrom = from;

  if (!smtpHost) {
    const dbHost = await SystemConfig.findByPk('SMTP_HOST');
    smtpHost = dbHost?.value || process.env.SMTP_HOST || '';
  }
  if (!smtpPort) {
    const dbPort = await SystemConfig.findByPk('SMTP_PORT');
    smtpPort = dbPort?.value || process.env.SMTP_PORT || '587';
  }
  if (!smtpUser) {
    const dbUser = await SystemConfig.findByPk('SMTP_USER');
    smtpUser = dbUser?.value || process.env.SMTP_USER || '';
  }
  if (!smtpPass || smtpPass.startsWith('****')) {
    const dbPass = await SystemConfig.findByPk('SMTP_PASS');
    smtpPass = dbPass?.value || process.env.SMTP_PASS || '';
  }
  if (!emailFrom) {
    const dbFrom = await SystemConfig.findByPk('EMAIL_FROM');
    emailFrom = dbFrom?.value || process.env.EMAIL_FROM || '';
  }

  if (!smtpHost || !smtpUser || !smtpPass || !emailFrom || !toEmail) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Vui lòng cung cấp đầy đủ thông tin SMTP và địa chỉ Email nhận.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465',
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      timeout: 10000
    } as any);

    await transporter.sendMail({
      from: `"Phong Thủy SIM Cát Hùng [TEST]" <${emailFrom}>`,
      to: toEmail,
      subject: 'Thư thử nghiệm cấu hình hệ thống',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; padding: 30px; border-radius: 12px;">
          <h2 style="color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 10px;">
            📧 SMTP Cấu Hình Hệ Thống
          </h2>
          <p>Xin chào,</p>
          <p>Đây là email tự động gửi thử nghiệm từ trang Cấu hình Hệ thống của Phong Thủy SIM Cát Hùng.</p>
          <p>Nếu bạn nhận được email này, cấu hình SMTP của bạn đã hoạt động chính xác!</p>
          <hr style="border-color: #333; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; text-align: center;">
            Cấu hình kiểm thử ngày: ${new Date().toLocaleString('vi-VN')}
          </p>
        </div>
      `
    });

    return sendSuccess(res, null, `Đã gửi email thử nghiệm thành công tới ${toEmail}.`);
  } catch (err: any) {
    console.error('[Admin Email Config] Test SMTP error:', err.message);
    throw {
      statusCode: 500,
      code: 'SMTP_CONFIG_ERROR',
      message: `Lỗi cấu hình SMTP hoặc gửi email thất bại: ${err.message}`
    };
  }
}

/**
 * Lấy danh sách nhật ký gửi mail hằng ngày
 * GET /api/v1/admin/email-logs
 * Query: status, search, date
 */
export async function getEmailLogs(req: Request, res: Response) {
  const { status, search, date } = req.query;
  const whereClause: any = {};

  if (status && typeof status === 'string' && status !== 'all') {
    whereClause.status = status;
  }

  if (date && typeof date === 'string' && date.trim()) {
    whereClause.date = date.trim();
  }

  const userWhereClause: any = {};
  if (search && typeof search === 'string' && search.trim()) {
    const searchVal = search.trim();
    userWhereClause[Op.or] = [
      { name: { [Op.like]: `%${searchVal}%` } },
      { phone: { [Op.like]: `%${searchVal}%` } },
      { email: { [Op.like]: `%${searchVal}%` } }
    ];
  }

  const logs = await DailyEmailLog.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined,
        attributes: ['id', 'name', 'phone', 'email', 'menh', 'focusArea']
      }
    ],
    order: [['sentAt', 'DESC']]
  });

  return sendSuccess(res, logs, `Lấy danh sách ${logs.length} nhật ký gửi mail thành công.`);
}

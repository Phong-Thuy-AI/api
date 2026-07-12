import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { SystemConfig, Order, User, DailyEmailLog, ChatRoom, ChatMessage, sequelize } from '@/models';
import { sendSuccess } from '@/utils/response';
import { generateAllDailyHoroscopes, sendAllDailyEmails, sendExpirationAlerts } from '@/services/cron.service';
import { forcePayOrder } from '@/services/payment.service';
import { getIO } from '@/services/socket.service';
import { getICTParts, getICTDateStrVN, getICTDateString } from '@/utils/date';

function clampReportRange(value: unknown): 7 | 30 | 90 {
  const parsed = parseInt(String(value || '30'), 10);
  if (parsed === 7 || parsed === 90) return parsed;
  return 30;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

function getReportStartDateKey(range: number): string {
  return addDaysToDateKey(getICTDateString(), -(range - 1));
}

function getReportStartDateSql(range: number): string {
  return `${getReportStartDateKey(range)} 00:00:00`;
}

function formatDateKey(date: Date): string {
  const parts = getICTParts(date);
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function buildDateKeys(range: number, startDateKey: string): string[] {
  return Array.from({ length: range }, (_, index) => {
    return addDaysToDateKey(startDateKey, index);
  });
}

function rowsByDate<T extends Record<string, any>>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => {
    const rawDate = row.date;
    const key = rawDate instanceof Date ? formatDateKey(rawDate) : String(rawDate).slice(0, 10);
    return [key, row];
  }));
}

function normalizeGroupRows(rows: Array<Record<string, any>>, labelKey = 'label') {
  return rows.map(row => ({
    label: String(row[labelKey] || 'Khong xac dinh'),
    value: toNumber(row.value),
    revenue: toNumber(row.revenue)
  }));
}

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

  const allowedKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'AI_PROXY_URL', 'ZALO_ADMIN_NUMBER'];
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
  let targetDate = new Date();
  const dateQuery = req.query.date;

  if (dateQuery && typeof dateQuery === 'string') {
    const parsed = new Date(dateQuery);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  } else {
    // Nếu kích hoạt sau 18h tối (giờ Việt Nam), tự động tạo tử vi cho ngày hôm sau
    const parts = getICTParts(targetDate);
    if (parts.hour >= 18) {
      targetDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // Chạy ngầm, không chờ để tránh timeout HTTP
  generateAllDailyHoroscopes(targetDate)
    .then(() => sendAllDailyEmails(targetDate))
    .then(() => sendExpirationAlerts())
    .catch(err => console.error('[Admin] triggerDailyHoroscopes error:', err));

  return sendSuccess(
    res,
    null,
    `Đã kích hoạt job tạo tử vi hằng ngày cho ngày ${getICTDateStrVN(targetDate)}. Quá trình đang chạy ngầm.`
  );
}

/**
 * Lấy danh sách tất cả đơn hàng kèm thông tin người dùng
 * GET /api/v1/admin/orders
 * Query: status, search
 */
export async function getReportOverview(req: Request, res: Response) {
  const range = clampReportRange(req.query.range);
  const startDateKey = getReportStartDateKey(range);
  const startDate = getReportStartDateSql(range);
  const replacements = { startDate };

  const [
    pageSummaryRows,
    simSummaryRows,
    orderSummaryRows,
    chatSummaryRows,
    emailSummaryRows,
    userSummaryRows,
    pageSeriesRows,
    simSeriesRows,
    orderSeriesRows,
    revenueSeriesRows,
    topPagesRows,
    orderStatusRows,
    packageTypeRows,
    focusAreaRows,
    chatSourceRows,
    emailStatusRows
  ] = await Promise.all([
    sequelize.query<Record<string, any>>(
      `SELECT COUNT(*) AS pageViews, COUNT(DISTINCT visitor_id) AS uniqueVisitors
       FROM analytics_page_views
       WHERE created_at >= :startDate`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT COUNT(*) AS simChecks
       FROM sim_check_events
       WHERE created_at >= :startDate`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT
         COUNT(*) AS orders,
         SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) AS paidOrders,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
         SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END) AS revenue
       FROM orders
       WHERE created_at >= :startDate`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT COUNT(*) AS activeChats
       FROM chat_rooms
       WHERE status = 'active'`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS emailSuccess,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS emailFailed
       FROM daily_email_logs
       WHERE sent_at >= :startDate`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT COUNT(*) AS newUsers
       FROM users
       WHERE created_at >= :startDate`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS pageViews, COUNT(DISTINCT visitor_id) AS uniqueVisitors
       FROM analytics_page_views
       WHERE created_at >= :startDate
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS simChecks
       FROM sim_check_events
       WHERE created_at >= :startDate
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS orders
       FROM orders
       WHERE created_at >= :startDate
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT DATE(COALESCE(paid_at, updated_at)) AS date, SUM(amount) AS revenue
       FROM orders
       WHERE status IN ('paid', 'completed') AND COALESCE(paid_at, updated_at) >= :startDate
       GROUP BY DATE(COALESCE(paid_at, updated_at))
       ORDER BY date ASC`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT path AS label, COUNT(*) AS value
       FROM analytics_page_views
       WHERE created_at >= :startDate
       GROUP BY path
       ORDER BY value DESC
       LIMIT 8`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT status AS label, COUNT(*) AS value
       FROM orders
       WHERE created_at >= :startDate
       GROUP BY status`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT package_type AS label, COUNT(*) AS value,
         SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END) AS revenue
       FROM orders
       WHERE created_at >= :startDate
       GROUP BY package_type`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT COALESCE(NULLIF(focus_area, ''), 'Khong xac dinh') AS label, COUNT(*) AS value
       FROM sim_check_events
       WHERE created_at >= :startDate
       GROUP BY COALESCE(NULLIF(focus_area, ''), 'Khong xac dinh')
       ORDER BY value DESC`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT source_type AS label, COUNT(*) AS value
       FROM chat_rooms
       WHERE created_at >= :startDate
       GROUP BY source_type`,
      { type: QueryTypes.SELECT, replacements }
    ),
    sequelize.query<Record<string, any>>(
      `SELECT status AS label, COUNT(*) AS value
       FROM daily_email_logs
       WHERE sent_at >= :startDate
       GROUP BY status`,
      { type: QueryTypes.SELECT, replacements }
    )
  ]);

  const pageSummary = pageSummaryRows[0] || {};
  const simSummary = simSummaryRows[0] || {};
  const orderSummary = orderSummaryRows[0] || {};
  const chatSummary = chatSummaryRows[0] || {};
  const emailSummary = emailSummaryRows[0] || {};
  const userSummary = userSummaryRows[0] || {};

  const pageSeries = rowsByDate(pageSeriesRows);
  const simSeries = rowsByDate(simSeriesRows);
  const orderSeries = rowsByDate(orderSeriesRows);
  const revenueSeries = rowsByDate(revenueSeriesRows);

  const series = buildDateKeys(range, startDateKey).map(date => ({
    date,
    pageViews: toNumber(pageSeries.get(date)?.pageViews),
    uniqueVisitors: toNumber(pageSeries.get(date)?.uniqueVisitors),
    simChecks: toNumber(simSeries.get(date)?.simChecks),
    orders: toNumber(orderSeries.get(date)?.orders),
    revenue: toNumber(revenueSeries.get(date)?.revenue)
  }));

  const pageViews = toNumber(pageSummary.pageViews);
  const simChecks = toNumber(simSummary.simChecks);

  return sendSuccess(res, {
    range,
    summary: {
      pageViews,
      uniqueVisitors: toNumber(pageSummary.uniqueVisitors),
      simChecks,
      conversionRate: pageViews > 0 ? Number(((simChecks / pageViews) * 100).toFixed(2)) : 0,
      orders: toNumber(orderSummary.orders),
      paidOrders: toNumber(orderSummary.paidOrders),
      revenue: toNumber(orderSummary.revenue),
      pendingOrders: toNumber(orderSummary.pendingOrders),
      activeChats: toNumber(chatSummary.activeChats),
      emailSuccess: toNumber(emailSummary.emailSuccess),
      emailFailed: toNumber(emailSummary.emailFailed),
      newUsers: toNumber(userSummary.newUsers)
    },
    series,
    breakdowns: {
      topPages: normalizeGroupRows(topPagesRows),
      orderStatus: normalizeGroupRows(orderStatusRows),
      packageTypes: normalizeGroupRows(packageTypeRows),
      focusAreas: normalizeGroupRows(focusAreaRows),
      chatSources: normalizeGroupRows(chatSourceRows),
      emailStatus: normalizeGroupRows(emailStatusRows)
    }
  }, 'Lay bao cao tong quan thanh cong.');
}

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

  // Đếm số lượt check cho mỗi user (cùng name + dob)
  const usersWithCheckCount = await Promise.all(
    users.map(async (u) => {
      const checkCount = await User.count({
        where: {
          name: u.name,
          dob: u.dob
        }
      });
      return {
        ...u.toJSON(),
        checkCount
      };
    })
  );

  return sendSuccess(res, usersWithCheckCount, `Lấy danh sách ${users.length} khách hàng thành công.`);
}

/**
 * Reset lượt check cho khách hàng (xóa các lượt check không có đơn hàng)
 * POST /api/v1/admin/users/:userId/reset-checks
 */
export async function resetUserChecks(req: Request, res: Response) {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã khách hàng không hợp lệ.' };
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Khách hàng không tồn tại.' };
  }

  const { name, dob } = user;
  const sisterUsers = await User.findAll({ where: { name, dob } });
  let deletedCount = 0;

  for (const sister of sisterUsers) {
    // Chỉ xóa các lượt check khác của người này nếu không có đơn hàng nào liên kết
    const orderCount = await Order.count({ where: { userId: sister.id } });
    if (orderCount === 0 && sister.id !== user.id) {
      await sister.destroy();
      deletedCount++;
    }
  }

  const newCheckCount = await User.count({ where: { name, dob } });

  return sendSuccess(
    res,
    { userId, newCheckCount, deletedCount },
    `Đã giải phóng ${deletedCount} lượt check cũ. Số lượt check hiện tại là ${newCheckCount}/5.`
  );
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
    'GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'AI_PROXY_URL', 'ZALO_ADMIN_NUMBER',
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
    'GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'AI_PROXY_URL', 'ZALO_ADMIN_NUMBER',
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


async function getProxyUrlBase(): Promise<string> {
  const dbConfig = await SystemConfig.findByPk('AI_PROXY_URL');
  const url = dbConfig?.value || process.env.AI_PROXY_URL || '';
  return url ? url.replace(/\/$/, '') : '';
}

/**
 * Lấy danh sách các model khả dụng từ nhà cung cấp AI
 * GET /api/v1/admin/ai/models
 */
export async function getAiModels(req: Request, res: Response) {
  const provider = String(req.query.provider || 'gemini');
  let apiKey = String(req.query.apiKey || '');
  const queryProxyUrl = req.query.proxyUrl ? String(req.query.proxyUrl) : '';

  if (!apiKey || apiKey.startsWith('****')) {
    const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : (provider === 'claude' ? 'CLAUDE_API_KEY' : 'GEMINI_API_KEY');
    const dbConfig = await SystemConfig.findByPk(keyName);
    apiKey = dbConfig?.value || process.env[keyName] || '';
  }

  if (!apiKey) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: `Thiếu API Key cho nhà cung cấp ${provider}.` };
  }

  const baseUrl = queryProxyUrl ? queryProxyUrl.replace(/\/$/, '') : await getProxyUrlBase();

  try {
    if (provider === 'openai') {
      const url = baseUrl ? `${baseUrl}/models` : 'https://api.openai.com/v1/models';
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 30000
      });
      const models = (response.data.data || []).map((m: any) => m.id);
      return sendSuccess(res, models, 'Lấy danh sách model OpenAI thành công.');
    } else if (provider === 'claude') {
      try {
        const url = baseUrl ? `${baseUrl}/v1/models` : 'https://api.anthropic.com/v1/models';
        const response = await axios.get(url, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        });
        const models = (response.data.data || []).map((m: any) => m.id);
        return sendSuccess(res, models, 'Lấy danh sách model Claude thành công.');
      } catch (e) {
        // Fallback danh sách model mặc định nếu API của Anthropic lỗi/không hỗ trợ liệt kê
        const defaultClaudeModels = [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229'
        ];
        return sendSuccess(res, defaultClaudeModels, 'Lấy danh sách model Claude (mặc định) thành công.');
      }
    } else {
      const url = baseUrl
        ? `${baseUrl}/v1beta/models?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await axios.get(url, {
        timeout: 30000
      });
      const models = (response.data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
      return sendSuccess(res, models, 'Lấy danh sách model Gemini thành công.');
    }
  } catch (err: any) {
    console.error('[Admin AI Config] Fetch models error:', err.message);
    const detailMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    throw {
      statusCode: 500,
      code: 'AI_PROVIDER_ERROR',
      message: `Không thể tải danh sách model từ ${provider}: ${detailMsg}`
    };
  }
}

/**
 * Kiểm tra kết nối AI
 * POST /api/v1/admin/ai/test-connection
 */
export async function testAiConnection(req: Request, res: Response) {
  const { provider, apiKey, model, proxyUrl, prompt } = req.body;
  let key = String(apiKey || '');

  if (!key || key.startsWith('****')) {
    const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : (provider === 'claude' ? 'CLAUDE_API_KEY' : 'GEMINI_API_KEY');
    const dbConfig = await SystemConfig.findByPk(keyName);
    key = dbConfig?.value || process.env[keyName] || '';
  }

  if (!key) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: `Thiếu API Key cho nhà cung cấp ${provider}.` };
  }

  const targetPrompt = prompt || 'Hãy trả lời ngắn gọn từ "pong" (không viết gì thêm).';
  const targetModel = model || (provider === 'openai' ? 'gpt-4o-mini' : (provider === 'claude' ? 'claude-3-5-haiku-20241022' : 'gemini-1.5-flash'));
  const baseUrl = proxyUrl ? String(proxyUrl).replace(/\/$/, '') : await getProxyUrlBase();

  try {
    if (provider === 'openai') {
      const url = baseUrl ? `${baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
      const response = await axios.post(url, {
        model: targetModel,
        messages: [{ role: 'user', content: targetPrompt }],
        max_tokens: 1000
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        timeout: 90000
      });
      const answer = response.data.choices?.[0]?.message?.content?.trim() || '';
      return sendSuccess(res, { answer }, 'Kết nối đến OpenAI thành công.');
    } else if (provider === 'claude') {
      const url = baseUrl ? `${baseUrl}/v1/messages` : 'https://api.anthropic.com/v1/messages';
      const response = await axios.post(url, {
        model: targetModel,
        messages: [{ role: 'user', content: targetPrompt }],
        max_tokens: 1000
      }, {
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        timeout: 90000
      });
      const answer = response.data.content?.[0]?.text?.trim() || '';
      return sendSuccess(res, { answer }, 'Kết nối đến Claude thành công.');
    } else {
      const url = baseUrl
        ? `${baseUrl}/v1beta/models/${targetModel}:generateContent?key=${key}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: targetPrompt }] }],
          generationConfig: { maxOutputTokens: 1000 }
        },
        { timeout: 90000 }
      );
      const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return sendSuccess(res, { answer }, 'Kết nối đến Gemini thành công.');
    }
  } catch (err: any) {
    console.error('[Admin AI Config] Test connection error:', err.message);
    const detailMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    throw {
      statusCode: 500,
      code: 'AI_PROVIDER_ERROR',
      message: `Lỗi kết nối AI: ${detailMsg}`
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
      tls: {
        rejectUnauthorized: false
      },
      timeout: 30000
    } as any);

    await transporter.sendMail({
      from: `"DI NHÂN PHONG THỦY SỐ [TEST]" <${emailFrom}>`,
      to: toEmail,
      subject: 'Thư thử nghiệm cấu hình hệ thống',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; padding: 30px; border-radius: 12px;">
          <h2 style="color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 10px;">
            📧 SMTP Cấu Hình Hệ Thống
          </h2>
          <p>Xin chào,</p>
          <p>Đây là email tự động gửi thử nghiệm từ trang Cấu hình Hệ thống của DI NHÂN PHONG THỦY SỐ.</p>
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

/**
 * Sinh mã giới thiệu gốc từ họ tên và số đuôi SIM được chốt
 */
function generateBaseReferralCode(name: string, lastDigits: string): string {
  const cleanName = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z\s]/g, '');

  const words = cleanName.trim().split(/\s+/);
  const initials = words.map(w => w.charAt(0).toUpperCase()).join('');

  return `${initials}${lastDigits}`;
}

/**
 * Đảm bảo mã giới thiệu là duy nhất
 */
async function getUniqueReferralCode(baseCode: string): Promise<string> {
  let uniqueCode = baseCode;
  let counter = 0;
  while (true) {
    const existing = await User.findOne({ where: { referralCode: uniqueCode } });
    if (!existing) break;
    counter++;
    uniqueCode = `${baseCode}${counter}`;
  }
  return uniqueCode;
}

/**
 * Admin chốt SIM cho khách - tạo mã giới thiệu, tặng 1 tháng tử vi, bắn tin nhắn hệ thống realtime
 * POST /api/v1/admin/orders/:orderId/confirm-sim
 */
export async function confirmSimOrder(req: Request, res: Response) {
  const orderId = parseInt(String(req.params.orderId), 10);
  const { lastDigits } = req.body;

  if (isNaN(orderId)) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Mã đơn hàng không hợp lệ.' };
  }

  if (!lastDigits || !/^\d{2,3}$/.test(String(lastDigits).trim())) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Vui lòng nhập đúng 2 hoặc 3 chữ số đuôi SIM.' };
  }

  const order = await Order.findByPk(orderId, {
    include: [{ model: User, as: 'user' }]
  });

  if (!order) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Đơn hàng không tồn tại.' };
  }

  const user = (order as any).user as User | null;
  if (!user) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Không tìm thấy khách hàng của đơn hàng này.' };
  }

  if (user.referralCode) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Khách hàng này đã được chốt SIM và có mã giới thiệu.' };
  }

  // 1. Sinh mã giới thiệu duy nhất
  const baseCode = generateBaseReferralCode(user.name, String(lastDigits).trim());
  const referralCode = await getUniqueReferralCode(baseCode);

  // 2. Lưu mã giới thiệu và gia hạn thêm 1 tháng (30 ngày) tử vi hằng ngày
  user.referralCode = referralCode;
  const now = new Date();
  const currentExpiry = user.horoscopeExpiresAt;
  user.horoscopeExpiresAt = currentExpiry && currentExpiry > now
    ? new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await user.save();

  // 3. Tìm phòng chat đang active để bắn tin nhắn hệ thống
  const chatRoom = await ChatRoom.findOne({
    where: { orderId: order.id, status: 'active' }
  });

  if (chatRoom) {
    const systemMessage = `🎁 MÃ GIỚI THIỆU CỦA BẠN: ${referralCode}`;

    // Lưu tin nhắn vào DB
    const chatMsg = await ChatMessage.create({
      roomId: chatRoom.id,
      senderType: 'system',
      message: systemMessage
    });

    // Phát tin nhắn realtime qua Socket
    try {
      const io = getIO();
      io.to(`room_${chatRoom.id}`).emit('receive_message', {
        id: chatMsg.id,
        roomId: chatRoom.id,
        senderType: 'system',
        message: chatMsg.message,
        createdAt: chatMsg.createdAt
      });
      console.log(`[Socket] Broadcast system confirm_sim message in room_${chatRoom.id}: ${referralCode}`);
    } catch (err) {
      console.error('[Socket] Failed to broadcast system message:', err);
    }
  }

  return sendSuccess(
    res,
    { referralCode, horoscopeExpiresAt: user.horoscopeExpiresAt },
    'Chốt SIM thành công, đã sinh mã giới thiệu và tặng 1 tháng tử vi hằng ngày miễn phí.'
  );
}

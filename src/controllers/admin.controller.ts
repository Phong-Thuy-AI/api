import { Request, Response } from 'express';
import { SystemConfig } from '@/models';
import { sendSuccess } from '@/utils/response';
import { generateAllDailyHoroscopes, sendAllDailyEmails } from '@/services/cron.service';

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

  // Ẩn bớt giá trị nhạy cảm (chỉ hiện 4 ký tự cuối)
  const maskedValue = config.value.length > 4
    ? '****' + config.value.slice(-4)
    : '****';

  return sendSuccess(res, { key: config.key, maskedValue }, 'Lấy cấu hình thành công.');
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

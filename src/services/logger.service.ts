import { Op } from 'sequelize';
import { SystemLog } from '@/models';

export interface LogInput {
  level?: 'error' | 'warn' | 'info';
  source?: 'api' | 'ai' | 'cron' | 'email' | 'payment';
  statusCode?: number | null;
  method?: string | null;
  path?: string | null;
  message: string;
  stack?: string | null;
  metadata?: any | null;
}

/**
  Ghi nhận log bất đồng bộ vào DB system_logs mà không làm nghẽn tiến trình API.
 */
export async function logError(input: LogInput): Promise<void> {
  try {
    await SystemLog.create({
      level: input.level || 'error',
      source: input.source || 'api',
      statusCode: input.statusCode || null,
      method: input.method ? input.method.toUpperCase() : null,
      path: input.path || null,
      message: input.message || 'Lỗi hệ thống không xác định',
      stack: input.stack || null,
      metadata: input.metadata || null
    });
  } catch (err: any) {
    console.error('[LoggerService] Lỗi khi ghi system_log vào DB:', err?.message || err);
  }
}

/**
 * Ghi log chuyên biệt cho lỗi gọi các dịch vụ AI (Gemini / Claude / OpenAI)
 */
export async function logAiError(
  provider: string,
  model: string,
  error: any,
  metadata?: any
): Promise<void> {
  const message = error?.response?.data?.error?.message || error?.message || `Lỗi không xác định từ AI provider ${provider}`;
  const stack = error?.stack || null;
  const statusCode = error?.response?.status || error?.status || (message.includes('429') ? 429 : 500);

  await logError({
    level: 'error',
    source: 'ai',
    statusCode,
    message: `[AI Error] ${provider} (${model}): ${message}`,
    stack,
    metadata: {
      provider,
      model,
      responseData: error?.response?.data || null,
      ...metadata
    }
  });
}

/**
 * Ghi log chuyên biệt cho lỗi Cron Job / Gửi mail tự động
 */
export async function logCronError(
  taskName: string,
  error: any,
  metadata?: any
): Promise<void> {
  const message = error?.message || String(error);
  const stack = error?.stack || null;

  await logError({
    level: 'error',
    source: 'cron',
    statusCode: 500,
    message: `[Cron Error] Task "${taskName}": ${message}`,
    stack,
    metadata
  });
}

/**
 * Dọn dẹp các log hệ thống cũ hơn X ngày (Mặc định 30 ngày)
 */
export async function cleanOldSystemLogs(days: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deletedCount = await SystemLog.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate }
      }
    });
    if (deletedCount > 0) {
      console.log(`[LoggerService] Đã dọn dẹp ${deletedCount} bản ghi log cũ hơn ${days} ngày.`);
    }
    return deletedCount;
  } catch (err: any) {
    console.error('[LoggerService] Lỗi khi dọn dẹp system_logs cũ:', err?.message || err);
    return 0;
  }
}

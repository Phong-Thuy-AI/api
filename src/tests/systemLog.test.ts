import { describe, test, expect, beforeAll } from '@jest/globals';
import { SystemLog } from '@/models';
import { logError, logAiError, logCronError, cleanOldSystemLogs } from '@/services/logger.service';

describe('Kiểm thử Quản lý Log lỗi hệ thống (SystemLog)', () => {
  beforeAll(async () => {
    await SystemLog.sync();
  });

  test('Ghi log lỗi API thông thường vào DB', async () => {
    const testMessage = 'Test API Error Logging 500';
    await logError({
      level: 'error',
      source: 'api',
      statusCode: 500,
      method: 'POST',
      path: '/api/v1/test/error',
      message: testMessage,
      stack: 'Error: Test Error\n    at TestFunc (test.ts:10:15)',
      metadata: { testKey: 'testVal' }
    });

    const savedLog = await SystemLog.findOne({
      where: { message: testMessage }
    });

    expect(savedLog).not.toBeNull();
    expect(savedLog?.statusCode).toBe(500);
    expect(savedLog?.source).toBe('api');
    expect(savedLog?.method).toBe('POST');
    expect(savedLog?.path).toBe('/api/v1/test/error');
    expect(savedLog?.stack).toContain('TestFunc');
  });

  test('Ghi log lỗi AI Provider', async () => {
    const aiError = new Error('Gemini Quota Exceeded 429');
    // @ts-ignore
    aiError.status = 429;

    await logAiError('gemini', 'gemini-1.5-flash', aiError, { promptLength: 100 });

    const savedLog = await SystemLog.findOne({
      where: { source: 'ai' },
      order: [['createdAt', 'DESC']]
    });

    expect(savedLog).not.toBeNull();
    expect(savedLog?.source).toBe('ai');
    expect(savedLog?.statusCode).toBe(429);
    expect(savedLog?.message).toContain('gemini-1.5-flash');
  });

  test('Ghi log lỗi Cron Job', async () => {
    const cronError = new Error('Mail SMTP Connection Failed');
    await logCronError('sendAllDailyEmails', cronError);

    const savedLog = await SystemLog.findOne({
      where: { source: 'cron' },
      order: [['createdAt', 'DESC']]
    });

    expect(savedLog).not.toBeNull();
    expect(savedLog?.source).toBe('cron');
    expect(savedLog?.message).toContain('sendAllDailyEmails');
  });

  test('Dọn dẹp log cũ hoạt động mà không gây lỗi DB', async () => {
    const deletedCount = await cleanOldSystemLogs(30);
    expect(typeof deletedCount).toBe('number');
  });
});

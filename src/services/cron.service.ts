import cron from 'node-cron';
import { Op } from 'sequelize';
import { DailyHoroscope, User, DailyEmailLog } from '@/models';
import { generateDailyHoroscope } from '@/services/ai.service';
import { sendDailyHoroscope } from '@/services/email.service';
import { checkAllPendingOrders } from '@/services/payment.service';
import { MENH_LIST, FOCUS_AREAS } from '@/utils/constants';
import { calculateLifePath, calculatePersonalVibrations, getCurrentPinnacle } from '@/utils/numerology';

/**
 * Tạo tử vi hằng ngày cá nhân hóa cho từng User có gói đăng ký còn hiệu lực.
 * Upsert vào bảng daily_horoscopes (unique index: date + user_id).
 */
export async function generateAllDailyHoroscopes(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Tìm tất cả user có subscription còn hiệu lực
  const activeUsers = await User.findAll({
    where: {
      horoscopeExpiresAt: { [Op.gt]: new Date() },
      focusArea: { [Op.not]: null }
    }
  });

  if (activeUsers.length === 0) {
    console.log(`[Cron] No active subscribers to generate personalized horoscopes for today (${today}).`);
    return;
  }

  console.log(`[Cron] Generating personalized daily horoscopes for ${activeUsers.length} active users on ${today}...`);
  let successCount = 0;

  for (const user of activeUsers) {
    try {
      // Kiểm tra xem đã có bản tử vi lưu trong DB chưa để tránh gọi AI trùng lặp
      const existing = await DailyHoroscope.findOne({
        where: { date: today, userId: user.id }
      });
      if (existing && existing.content) {
        console.log(`[Cron] Horoscope already cached for User ${user.id} (${user.name}), skipping AI call.`);
        successCount++;
        continue;
      }

      // Lấy thông tin ngày sinh
      const dobStr = typeof user.dob === 'string' ? user.dob : new Date(user.dob).toISOString().slice(0, 10);

      // Tính toán chỉ số thần số học hằng ngày
      const { lifePath, reducedLifePath } = calculateLifePath(dobStr);
      const targetDate = new Date();
      const { personalYear, personalMonth, personalDay } = calculatePersonalVibrations(dobStr, targetDate);
      const currentPinnacle = getCurrentPinnacle(dobStr, reducedLifePath, targetDate);

      const content = await generateDailyHoroscope({
        name: user.name,
        menh: user.menh,
        focusArea: user.focusArea!,
        dateStr,
        lifePath,
        personalYear,
        personalMonth,
        personalDay,
        currentPinnacle,
        tob: user.tob
      });

      if (!content) {
        console.warn(`[Cron] AI returned null for User ${user.id} (${user.name}), skipping.`);
        continue;
      }

      await DailyHoroscope.upsert({
        date: today,
        menh: user.menh,
        focusArea: user.focusArea!,
        content,
        userId: user.id
      });

      successCount++;
      console.log(`[Cron] Saved personalized horoscope for User ${user.id} (${user.name})`);

      // Delay 6 giây giữa các lần gọi AI để tránh dính hạn mức 15 RPM của Gemini Free Tier
      await new Promise(r => setTimeout(r, 6000));
    } catch (err) {
      console.error(`[Cron] Error generating personalized horoscope for User ${user.id} (${user.name}):`, err);
    }
  }

  console.log(`[Cron] Horoscope generation done: ${successCount}/${activeUsers.length} saved.`);
}

/**
 * Gửi email tử vi ngày hôm nay đến tất cả user có subscription còn hiệu lực.
 */
export async function sendAllDailyEmails(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const activeUsers = await User.findAll({
    where: {
      horoscopeExpiresAt: { [Op.gt]: new Date() },
      focusArea: { [Op.not]: null },
      email: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: '' }] }
    }
  });

  if (activeUsers.length === 0) {
    console.log('[Cron] No active horoscope subscribers.');
    return;
  }

  console.log(`[Cron] Sending daily horoscope emails to ${activeUsers.length} subscribers...`);
  let sentCount = 0;

  for (const user of activeUsers) {
    try {
      const horoscope = await DailyHoroscope.findOne({
        where: { date: today, userId: user.id }
      });

      if (!horoscope) {
        console.warn(`[Cron] No personalized horoscope found in DB for User ${user.id} (${user.name}), skipping email.`);
        await DailyEmailLog.create({
          userId: user.id,
          email: user.email!,
          date: today,
          status: 'failed',
          error: `Không tìm thấy nội dung tử vi cá nhân hóa cho User ${user.id}`,
          sentAt: new Date()
        });
        continue;
      }

      await sendDailyHoroscope(user.email!, user.name, user.menh, horoscope.content, dateStr);
      sentCount++;
      console.log(`[Cron] Sent personalized horoscope email to ${user.email!}`);

      await DailyEmailLog.create({
        userId: user.id,
        email: user.email!,
        date: today,
        status: 'success',
        sentAt: new Date()
      });
    } catch (err: any) {
      console.error(`[Cron] Failed to send email to ${user.email!}:`, err);
      await DailyEmailLog.create({
        userId: user.id,
        email: user.email!,
        date: today,
        status: 'failed',
        error: err.message || 'Lỗi gửi mail qua SMTP',
        sentAt: new Date()
      });
    }
  }

  console.log(`[Cron] Email send done: ${sentCount}/${activeUsers.length} sent.`);
}

/**
 * Khởi tạo tất cả cron jobs.
 * Gọi 1 lần khi server start.
 */
export function initCronJobs(): void {
  // 0:00 mỗi ngày, múi giờ Việt Nam
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Daily horoscope job triggered at 00:00 ICT.');
    await generateAllDailyHoroscopes();
    await sendAllDailyEmails();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  // Tự động đối soát các đơn hàng pending mỗi 20 giây để hỗ trợ trường hợp tắt modal/mất kết nối
  setInterval(async () => {
    try {
      await checkAllPendingOrders();
    } catch (err) {
      console.error('[Cron] Lỗi quét đối soát đơn hàng pending:', err);
    }
  }, 20000);

  console.log('[Cron] Cron jobs initialized (daily horoscope at 00:00 ICT).');
}

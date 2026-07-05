import nodemailer from 'nodemailer';
import { SystemConfig } from '@/models';

async function getEmailConfig() {
  const dbHost = await SystemConfig.findByPk('SMTP_HOST');
  const dbPort = await SystemConfig.findByPk('SMTP_PORT');
  const dbUser = await SystemConfig.findByPk('SMTP_USER');
  const dbPass = await SystemConfig.findByPk('SMTP_PASS');
  const dbFrom = await SystemConfig.findByPk('EMAIL_FROM');

  return {
    host: dbHost?.value || process.env.SMTP_HOST || '',
    port: parseInt(dbPort?.value || process.env.SMTP_PORT || '587', 10),
    user: dbUser?.value || process.env.SMTP_USER || '',
    pass: dbPass?.value || process.env.SMTP_PASS || '',
    from: dbFrom?.value || process.env.EMAIL_FROM || ''
  };
}

async function getTransporterAndFrom() {
  const config = await getEmailConfig();
  if (!config.host || !config.user || !config.pass || !config.from) {
    console.warn('[Email] Bỏ qua gửi email vì SMTP chưa được cấu hình đầy đủ.');
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return { transporter, from: config.from };
}

/**
 * Gửi báo cáo luận giải SIM phong thủy sau khi user check
 */
export async function sendSimReport(
  to: string,
  name: string,
  analysisContent: string
): Promise<void> {
  const smtp = await getTransporterAndFrom();
  if (!smtp) return;

  await smtp.transporter.sendMail({
    from: `"DI NHÂN PHONG THỦY SỐ" <${smtp.from}>`,
    to,
    subject: `Báo cáo phong thủy SIM của ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; padding: 30px; border-radius: 12px;">
        <h2 style="color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 10px;">
          ✨ Báo cáo Phong Thủy SIM
        </h2>
        <p>Kính gửi <strong>${name}</strong>,</p>
        <p>Cảm ơn bạn đã sử dụng dịch vụ luận giải SIM phong thủy. Dưới đây là phân tích chi tiết dành riêng cho bạn:</p>
        <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; border-left: 4px solid #D4AF37; margin: 20px 0; line-height: 1.8;">
          ${analysisContent.replace(/\n/g, '<br>')}
        </div>
        <p>Để được tư vấn chọn SIM cải vận chuyên sâu, hãy đăng ký gói dịch vụ tại website của chúng tôi.</p>
        <hr style="border-color: #333; margin: 20px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          DI NHÂN PHONG THỦY SỐ — Cải vận theo mệnh, đổi số đổi đời.
        </p>
      </div>
    `
  });
}

/**
 * Gửi email tử vi nhắc vận hằng ngày
 */
export async function sendDailyHoroscope(
  to: string,
  name: string,
  menh: string,
  content: string,
  dateStr: string
): Promise<void> {
  const smtp = await getTransporterAndFrom();
  if (!smtp) return;

  await smtp.transporter.sendMail({
    from: `"DI NHÂN PHONG THỦY SỐ" <${smtp.from}>`,
    to,
    subject: `🌟 Tử vi vận khí ngày ${dateStr} — Mệnh ${menh}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; padding: 30px; border-radius: 12px;">
        <h2 style="color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 10px;">
          🌟 Tử Vi Vận Khí — ${dateStr}
        </h2>
        <p>Chào <strong>${name}</strong>,</p>
        <p>Đây là nhắc nhở vận khí hôm nay dành riêng cho người mệnh <strong>${menh}</strong>:</p>
        <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; border-left: 4px solid #D4AF37; margin: 20px 0; line-height: 1.8;">
          ${content.replace(/\n/g, '<br>')}
        </div>
        <hr style="border-color: #333; margin: 20px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          DI NHÂN PHONG THỦY SỐ — Cải vận theo mệnh, đổi số đổi đời.
        </p>
      </div>
    `
  });
}

/**
 * Gửi email thông báo hết hạn dùng thử/gói đăng ký và mời gia hạn 365k/năm
 */
export async function sendSubscriptionExpiryEmail(
  to: string,
  name: string,
  renewLink: string
): Promise<void> {
  const smtp = await getTransporterAndFrom();
  if (!smtp) return;

  await smtp.transporter.sendMail({
    from: `"DI NHÂN PHONG THỦY SỐ" <${smtp.from}>`,
    to,
    subject: `🔔 Thông báo: Gói tử vi hằng ngày của bạn đã hết hạn`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; padding: 30px; border-radius: 12px;">
        <h2 style="color: #ff4d4d; border-bottom: 1px solid #ff4d4d; padding-bottom: 10px; margin-top: 0;">
          ⏳ Gói dịch vụ đã hết hạn
        </h2>
        <p>Kính gửi <strong>${name}</strong>,</p>
        <p>Gói nhận tin tử vi nhắc vận cát hung hằng ngày (bản dùng thử 1 tháng hoặc gói trước đó của bạn) đã chính thức hết hạn sử dụng.</p>
        
        <p>Để tiếp tục nhận được bản tin luận giải chiêm nghiệm vận cát hung cá nhân hóa hằng ngày dựa trên bản mệnh số học của bạn, vui lòng click vào nút bên dưới để gia hạn gói dịch vụ với giá ưu đãi chỉ <strong>365.000đ / 1 năm</strong> (chỉ ~1.000đ/ngày):</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${renewLink}" target="_blank" style="background: linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%); color: #000; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(212,175,55,0.3);">
            👉 Gia hạn dịch vụ ngay
          </a>
        </div>
        
        <p style="font-size: 13px; color: #aaa;">* Lưu ý: Link gia hạn phía trên tích hợp mã xác thực đăng nhập một chạm tự động, giúp bạn thực hiện thanh toán nhanh chóng mà không cần đăng nhập lại.</p>
        
        <hr style="border-color: #333; margin: 20px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          DI NHÂN PHONG THỦY SỐ — Cải vận theo mệnh, đổi số đổi đời.
        </p>
      </div>
    `
  });
}

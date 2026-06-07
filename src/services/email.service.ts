import nodemailer from 'nodemailer';

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Gửi báo cáo luận giải SIM phong thủy sau khi user check
 */
export async function sendSimReport(
  to: string,
  name: string,
  analysisContent: string
): Promise<void> {
  if (!isSmtpConfigured()) return;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Phong Thủy SIM Cát Hùng" <${process.env.EMAIL_FROM}>`,
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
          Phong Thủy SIM Cát Hùng — Cải vận theo mệnh, đổi số đổi đời.
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
  if (!isSmtpConfigured()) return;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Phong Thủy SIM Cát Hùng" <${process.env.EMAIL_FROM}>`,
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
          Phong Thủy SIM Cát Hùng — Cải vận theo mệnh, đổi số đổi đời.
        </p>
      </div>
    `
  });
}

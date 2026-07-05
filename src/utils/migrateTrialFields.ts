import { sequelize } from '../models'

async function runMigration() {
  try {
    console.log('--- BẮT ĐẦU MIGRATION THÊM CÁC TRƯỜNG DÙNG THỬ & HẾT HẠN ---');
    console.log('Đang kết nối cơ sở dữ liệu...');
    await sequelize.authenticate();
    console.log('Kết nối thành công. Đang kiểm tra và thực thi ALTER TABLE...');

    // 1. Thêm cột trial_used
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN trial_used TINYINT(1) NOT NULL DEFAULT 0;');
      console.log('✅ Đã thêm cột `trial_used` thành công.');
    } catch (e: any) {
      if (e.original && e.original.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Cột `trial_used` đã tồn tại, bỏ qua.');
      } else {
        throw e;
      }
    }

    // 2. Thêm cột expiry_email_sent
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN expiry_email_sent TINYINT(1) NOT NULL DEFAULT 0;');
      console.log('✅ Đã thêm cột `expiry_email_sent` thành công.');
    } catch (e: any) {
      if (e.original && e.original.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Cột `expiry_email_sent` đã tồn tại, bỏ qua.');
      } else {
        throw e;
      }
    }

    console.log('--- MIGRATION HOÀN THÀNH ---');
    process.exit(0);
  } catch (error: any) {
    if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Bảng 'users' chưa tồn tại. Bỏ qua migration này.");
      process.exit(0);
    }
    console.error('❌ LỖI TRONG QUÁ TRÌNH MIGRATION:', error);
    process.exit(1);
  }
}

runMigration();

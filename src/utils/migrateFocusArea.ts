import { sequelize } from '../models'

async function runMigration() {
  try {
    console.log('--- BẮT ĐẦU MIGRATION HỆ THỐNG (FOCUS_AREA) ---');
    console.log('Đang kết nối cơ sở dữ liệu...');
    await sequelize.authenticate();
    console.log('Kết nối thành công. Đang thực thi ALTER TABLE...');

    // Thay đổi cột focus_area trong bảng users thành VARCHAR(255)
    await sequelize.query('ALTER TABLE users MODIFY COLUMN focus_area VARCHAR(255) NULL;');
    console.log('✅ Đã cập nhật thành công cột `focus_area` trong bảng `users` thành VARCHAR(255).');

    console.log('--- MIGRATION HOÀN THÀNH ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH MIGRATION:', error);
    process.exit(1);
  }
}

runMigration();

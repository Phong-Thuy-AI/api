import { sequelize } from '../models'

async function runMigration() {
  try {
    console.log('--- BẮT ĐẦU MIGRATION HỆ THỐNG ---');
    console.log('Đang kết nối cơ sở dữ liệu...');
    await sequelize.authenticate();
    console.log('Kết nối thành công. Đang thực thi ALTER TABLE...');

    // Thay đổi cột email trong bảng users thành NULL
    await sequelize.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;');
    console.log('✅ Đã cập nhật thành công cột `email` trong bảng `users` thành NULL.');

    console.log('--- MIGRATION HOÀN THÀNH ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH MIGRATION:', error);
    process.exit(1);
  }
}

runMigration();

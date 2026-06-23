import { sequelize } from '../models'

async function runMigration() {
  try {
    console.log('--- BẮT ĐẦU MIGRATION HỆ THỐNG (DAILY_HOROSCOPES) ---');
    console.log('Đang kết nối cơ sở dữ liệu...');
    await sequelize.authenticate();
    console.log('Kết nối thành công. Đang thực thi ALTER TABLE...');

    // 1. Thêm cột user_id nếu chưa có
    try {
      await sequelize.query('ALTER TABLE daily_horoscopes ADD COLUMN user_id INT NULL;');
      console.log('✅ Đã thêm cột `user_id` vào bảng `daily_horoscopes`.');
    } catch (err: any) {
      if (err.message && (err.message.includes('Duplicate column name') || err.message.includes('already exists'))) {
        console.log('ℹ️ Cột `user_id` đã tồn tại từ trước.');
      } else {
        throw err;
      }
    }

    // 2. Drop unique index cũ daily_horoscopes_date_menh_focus_area nếu tồn tại
    try {
      await sequelize.query('ALTER TABLE daily_horoscopes DROP KEY daily_horoscopes_date_menh_focus_area;');
      console.log('✅ Đã xóa unique key `daily_horoscopes_date_menh_focus_area`.');
    } catch (err: any) {
      if (err.message && (err.message.includes('check that column/key exists') || err.message.includes("Can't DROP") || err.message.includes("does not exist"))) {
        console.log('ℹ️ Unique key `daily_horoscopes_date_menh_focus_area` không tồn tại hoặc đã được xóa trước đó.');
      } else {
        throw err;
      }
    }

    // 3. Thêm unique index mới daily_horoscopes_date_user_id
    try {
      await sequelize.query('ALTER TABLE daily_horoscopes ADD UNIQUE KEY daily_horoscopes_date_user_id (date, user_id);');
      console.log('✅ Đã thêm unique key mới `daily_horoscopes_date_user_id` trên (date, user_id).');
    } catch (err: any) {
      if (err.message && (err.message.includes('Duplicate key name') || err.message.includes('already exists'))) {
        console.log('ℹ️ Unique key `daily_horoscopes_date_user_id` đã tồn tại.');
      } else {
        throw err;
      }
    }

    console.log('--- MIGRATION HOÀN THÀNH ---');
    process.exit(0);
  } catch (error: any) {
    if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Bảng 'daily_horoscopes' chưa tồn tại. Bỏ qua migration này.");
      process.exit(0);
    }
    console.error('❌ LỖI TRONG QUÁ TRÌNH MIGRATION:', error);
    process.exit(1);
  }
}

runMigration();

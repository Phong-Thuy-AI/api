import { sequelize } from '../models';

async function runMigration() {
  try {
    console.log('--- BẮT ĐẦU MIGRATION CƠ SỞ DỮ LIỆU (SYSTEM_LOGS) ---');
    console.log('Đang kết nối cơ sở dữ liệu...');
    await sequelize.authenticate();
    console.log('Kết nối thành công. Đang thực thi CREATE TABLE / ALTER TABLE...');

    // 1. Tạo bảng system_logs nếu chưa tồn tại
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('error', 'warn', 'info') NOT NULL DEFAULT 'error',
        source ENUM('api', 'ai', 'cron', 'email', 'payment') NOT NULL DEFAULT 'api',
        status_code INT NULL,
        method VARCHAR(10) NULL,
        path VARCHAR(255) NULL,
        message TEXT NOT NULL,
        stack LONGTEXT NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_system_logs_level (level),
        INDEX idx_system_logs_source (source),
        INDEX idx_system_logs_status_code (status_code),
        INDEX idx_system_logs_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Bảng `system_logs` đã được tạo và sẵn sàng sử dụng.');
    console.log('--- MIGRATION SYSTEM_LOGS HOÀN THÀNH ---');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH MIGRATION SYSTEM_LOGS:', error);
    process.exit(1);
  }
}

runMigration();

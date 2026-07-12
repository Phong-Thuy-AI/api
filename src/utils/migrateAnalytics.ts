import { sequelize } from '../models'

async function runMigration() {
  try {
    console.log('--- Starting analytics migration ---')
    await sequelize.authenticate()

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS analytics_page_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitor_id VARCHAR(80) NOT NULL,
        session_id VARCHAR(80) NOT NULL,
        path VARCHAR(255) NOT NULL,
        referrer VARCHAR(500) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_analytics_page_views_created_at (created_at),
        INDEX idx_analytics_page_views_visitor_id (visitor_id),
        INDEX idx_analytics_page_views_path (path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sim_check_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        phone_last4 VARCHAR(4) NULL,
        total_score INT NOT NULL,
        rating VARCHAR(50) NOT NULL,
        focus_area VARCHAR(255) NULL,
        referred_by_code VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sim_check_events_created_at (created_at),
        INDEX idx_sim_check_events_user_id (user_id),
        INDEX idx_sim_check_events_focus_area (focus_area)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    console.log('--- Analytics migration completed ---')
    process.exit(0)
  } catch (error) {
    console.error('Analytics migration failed:', error)
    process.exit(1)
  }
}

runMigration()

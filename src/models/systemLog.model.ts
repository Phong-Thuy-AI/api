import { Model, DataTypes } from 'sequelize';
import sequelize from '@/config/database';

export interface SystemLogAttributes {
  id?: number;
  level: 'error' | 'warn' | 'info';
  source: 'api' | 'ai' | 'cron' | 'email' | 'payment';
  statusCode?: number | null;
  method?: string | null;
  path?: string | null;
  message: string;
  stack?: string | null;
  metadata?: any | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SystemLog extends Model<SystemLogAttributes> implements SystemLogAttributes {
  declare id: number;
  declare level: 'error' | 'warn' | 'info';
  declare source: 'api' | 'ai' | 'cron' | 'email' | 'payment';
  declare statusCode: number | null;
  declare method: string | null;
  declare path: string | null;
  declare message: string;
  declare stack: string | null;
  declare metadata: any | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SystemLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    level: {
      type: DataTypes.ENUM('error', 'warn', 'info'),
      allowNull: false,
      defaultValue: 'error'
    },
    source: {
      type: DataTypes.ENUM('api', 'ai', 'cron', 'email', 'payment'),
      allowNull: false,
      defaultValue: 'api'
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'status_code'
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    stack: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'system_logs',
    underscored: true,
    indexes: [
      { fields: ['level'] },
      { fields: ['source'] },
      { fields: ['status_code'] },
      { fields: ['created_at'] }
    ]
  }
);

export default SystemLog;

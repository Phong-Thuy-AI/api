import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface DailyEmailLogAttributes {
  id?: number
  userId: number
  email: string
  date: string
  status: 'success' | 'failed'
  error?: string | null
  sentAt: Date
}

export class DailyEmailLog extends Model<DailyEmailLogAttributes> implements DailyEmailLogAttributes {
  declare id: number
  declare userId: number
  declare email: string
  declare date: string
  declare status: 'success' | 'failed'
  declare error: string | null
  declare sentAt: Date

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

DailyEmailLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
    email: { type: DataTypes.STRING(255), allowNull: false },
    date: { type: DataTypes.STRING(10), allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false },
    error: { type: DataTypes.TEXT, allowNull: true },
    sentAt: { type: DataTypes.DATE, allowNull: false, field: 'sent_at' }
  },
  { sequelize, tableName: 'daily_email_logs', underscored: true }
)

export default DailyEmailLog

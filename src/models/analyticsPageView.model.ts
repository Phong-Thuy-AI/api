import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface AnalyticsPageViewAttributes {
  id?: number
  visitorId: string
  sessionId: string
  path: string
  referrer?: string | null
  userAgent?: string | null
}

export class AnalyticsPageView extends Model<AnalyticsPageViewAttributes> implements AnalyticsPageViewAttributes {
  declare id: number
  declare visitorId: string
  declare sessionId: string
  declare path: string
  declare referrer: string | null
  declare userAgent: string | null

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

AnalyticsPageView.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    visitorId: { type: DataTypes.STRING(80), allowNull: false, field: 'visitor_id' },
    sessionId: { type: DataTypes.STRING(80), allowNull: false, field: 'session_id' },
    path: { type: DataTypes.STRING(255), allowNull: false },
    referrer: { type: DataTypes.STRING(500), allowNull: true },
    userAgent: { type: DataTypes.STRING(255), allowNull: true, field: 'user_agent' }
  },
  { sequelize, tableName: 'analytics_page_views', underscored: true }
)

export default AnalyticsPageView

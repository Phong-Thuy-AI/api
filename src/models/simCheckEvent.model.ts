import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface SimCheckEventAttributes {
  id?: number
  userId: number
  phoneLast4?: string | null
  totalScore: number
  rating: string
  focusArea?: string | null
  referredByCode?: string | null
}

export class SimCheckEvent extends Model<SimCheckEventAttributes> implements SimCheckEventAttributes {
  declare id: number
  declare userId: number
  declare phoneLast4: string | null
  declare totalScore: number
  declare rating: string
  declare focusArea: string | null
  declare referredByCode: string | null

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

SimCheckEvent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
    phoneLast4: { type: DataTypes.STRING(4), allowNull: true, field: 'phone_last4' },
    totalScore: { type: DataTypes.INTEGER, allowNull: false, field: 'total_score' },
    rating: { type: DataTypes.STRING(50), allowNull: false },
    focusArea: { type: DataTypes.STRING(255), allowNull: true, field: 'focus_area' },
    referredByCode: { type: DataTypes.STRING(50), allowNull: true, field: 'referred_by_code' }
  },
  { sequelize, tableName: 'sim_check_events', underscored: true }
)

export default SimCheckEvent

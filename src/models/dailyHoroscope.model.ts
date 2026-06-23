import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface DailyHoroscopeAttributes {
  id?: number
  date: Date | string
  menh: string
  focusArea: string
  content: string
  userId?: number | null
}

export class DailyHoroscope extends Model<DailyHoroscopeAttributes> implements DailyHoroscopeAttributes {
  declare id: number
  declare date: Date | string
  declare menh: string
  declare focusArea: string
  declare content: string
  declare userId: number | null

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

DailyHoroscope.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    menh: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    focusArea: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'focus_area'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id'
    }
  },
  {
    sequelize,
    tableName: 'daily_horoscopes',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['date', 'user_id']
      }
    ]
  }
)

export default DailyHoroscope

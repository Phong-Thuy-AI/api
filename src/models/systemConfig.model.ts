import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface SystemConfigAttributes {
  key: string
  value: string
}

export class SystemConfig extends Model<SystemConfigAttributes> implements SystemConfigAttributes {
  declare key: string
  declare value: string

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

SystemConfig.init(
  {
    key: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'system_configs',
    underscored: true
  }
)

export default SystemConfig

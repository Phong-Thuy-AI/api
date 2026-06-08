import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface UserAttributes {
  id?: number
  name: string
  email: string
  phone: string
  dob: Date
  tob: string
  menh: string
  focusArea?: string | null
  lastCheckResult?: string | null
  referralCode?: string | null
  referredByCode?: string | null
  horoscopeExpiresAt?: Date | null
  referralBonusMonths?: number
}

export class User extends Model<UserAttributes> implements UserAttributes {
  declare id: number
  declare name: string
  declare email: string
  declare phone: string
  declare dob: Date
  declare tob: string
  declare menh: string
  declare focusArea: string | null
  declare lastCheckResult: string | null
  declare referralCode: string | null
  declare referredByCode: string | null
  declare horoscopeExpiresAt: Date | null
  declare referralBonusMonths: number

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    dob: { type: DataTypes.DATEONLY, allowNull: false },
    tob: { type: DataTypes.STRING(50), allowNull: false },
    menh: { type: DataTypes.STRING(50), allowNull: false },
    focusArea: { type: DataTypes.STRING(50), allowNull: true, field: 'focus_area' },
    lastCheckResult: { type: DataTypes.TEXT, allowNull: true, field: 'last_check_result' },
    referralCode: { type: DataTypes.STRING(50), unique: true, allowNull: true, field: 'referral_code' },
    referredByCode: { type: DataTypes.STRING(50), allowNull: true, field: 'referred_by_code' },
    horoscopeExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'horoscope_expires_at' },
    referralBonusMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'referral_bonus_months' }
  },
  { sequelize, tableName: 'users', underscored: true }
)

export default User

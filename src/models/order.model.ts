import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface OrderAttributes {
  id?: number
  userId: number
  packageType: '200k' | '500k' | '365k'
  amount: number
  paymentCode: string
  status?: 'pending' | 'paid' | 'expired' | 'completed'
  web2mTransactionId?: string | null
  paidAt?: Date | null
  carrier?: string | null
  consultationTopic?: string | null
}

export class Order extends Model<OrderAttributes> implements OrderAttributes {
  declare id: number
  declare userId: number
  declare packageType: '200k' | '500k' | '365k'
  declare amount: number
  declare paymentCode: string
  declare status: 'pending' | 'paid' | 'expired' | 'completed'
  declare web2mTransactionId: string | null
  declare paidAt: Date | null
  declare carrier: string | null
  declare consultationTopic: string | null

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

Order.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
    packageType: { type: DataTypes.ENUM('200k', '500k', '365k'), allowNull: false, field: 'package_type' },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    paymentCode: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'payment_code' },
    status: { type: DataTypes.ENUM('pending', 'paid', 'expired', 'completed'), allowNull: false, defaultValue: 'pending' },
    web2mTransactionId: { type: DataTypes.STRING(255), allowNull: true, field: 'web2m_transaction_id' },
    paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
    carrier: { type: DataTypes.STRING(100), allowNull: true },
    consultationTopic: { type: DataTypes.STRING(100), allowNull: true, field: 'consultation_topic' }
  },
  { sequelize, tableName: 'orders', underscored: true }
)

export default Order

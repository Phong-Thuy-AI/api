import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface ChatRoomAttributes {
  id?: number
  orderId: number
  status?: 'active' | 'closed'
  sourceType?: 'direct' | 'referral'
}

export class ChatRoom extends Model<ChatRoomAttributes> implements ChatRoomAttributes {
  declare id: number
  declare orderId: number
  declare status: 'active' | 'closed'
  declare sourceType: 'direct' | 'referral'

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

ChatRoom.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false, field: 'order_id' },
    status: { type: DataTypes.ENUM('active', 'closed'), allowNull: false, defaultValue: 'active' },
    sourceType: { type: DataTypes.ENUM('direct', 'referral'), allowNull: false, defaultValue: 'direct', field: 'source_type' }
  },
  { sequelize, tableName: 'chat_rooms', underscored: true }
)

export default ChatRoom

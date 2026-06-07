import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface ChatMessageAttributes {
  id?: number
  roomId: number
  senderType: 'user' | 'admin' | 'system'
  message: string
}

export class ChatMessage extends Model<ChatMessageAttributes> implements ChatMessageAttributes {
  declare id: number
  declare roomId: number
  declare senderType: 'user' | 'admin' | 'system'
  declare message: string

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

ChatMessage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    roomId: { type: DataTypes.INTEGER, allowNull: false, field: 'room_id' },
    senderType: { type: DataTypes.ENUM('user', 'admin', 'system'), allowNull: false, field: 'sender_type' },
    message: { type: DataTypes.TEXT, allowNull: false }
  },
  { sequelize, tableName: 'chat_messages', underscored: true }
)

export default ChatMessage

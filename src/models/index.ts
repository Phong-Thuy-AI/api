import { sequelize } from '@/config/database'
import { User } from './user.model'
import { Hexagram } from './hexagram.model'
import { Order } from './order.model'
import { ChatRoom } from './chatRoom.model'
import { ChatMessage } from './chatMessage.model'
import { DailyHoroscope } from './dailyHoroscope.model'
import { SystemConfig } from './systemConfig.model'

// Define Associations

// User <-> Order (One-to-Many)
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' })
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' })

// Order <-> ChatRoom (One-to-One)
Order.hasOne(ChatRoom, { foreignKey: 'orderId', as: 'chatRoom' })
ChatRoom.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })

// ChatRoom <-> ChatMessage (One-to-Many)
ChatRoom.hasMany(ChatMessage, { foreignKey: 'roomId', as: 'messages' })
ChatMessage.belongsTo(ChatRoom, { foreignKey: 'roomId', as: 'chatRoom' })

export {
  sequelize,
  User,
  Hexagram,
  Order,
  ChatRoom,
  ChatMessage,
  DailyHoroscope,
  SystemConfig
}

export default {
  sequelize,
  User,
  Hexagram,
  Order,
  ChatRoom,
  ChatMessage,
  DailyHoroscope,
  SystemConfig
}

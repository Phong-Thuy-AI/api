import { Model, DataTypes } from 'sequelize'
import sequelize from '@/config/database'

export interface HexagramAttributes {
  id: number
  name: string
  originalText: string
  cleanedText: string
  classification: string
}

export class Hexagram extends Model<HexagramAttributes> implements HexagramAttributes {
  declare id: number
  declare name: string
  declare originalText: string
  declare cleanedText: string
  declare classification: string

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

Hexagram.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    originalText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'original_text'
    },
    cleanedText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'cleaned_text'
    },
    classification: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'hexagrams',
    underscored: true
  }
)

export default Hexagram

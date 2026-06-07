import dotenv from 'dotenv'

dotenv.config()

export const WEB2M_CONFIG = {
  apiGetQr: process.env.WEB2M_API_GET_QR || 'https://api.web2m.com/api/QR',
  apiGetTransaction: process.env.WEB2M_API_GET_TRANSACTION || 'https://api.web2m.com/api/getTransaction',
  bankName: process.env.WEB2M_BANK_NAME || 'MBBank',
  bankNumber: process.env.WEB2M_BANK_NUMBER || '',
  bankPassword: process.env.WEB2M_BANK_PASSWORD || '',
  bankToken: process.env.WEB2M_BANK_TOKEN || '',
  accountHolder: process.env.WEB2M_ACCOUNT_HOLDER || '',
  isMask: process.env.WEB2M_IS_MASK || 'false',
  bankBackground: process.env.WEB2M_BANK_BACKGROUND || 'default'
}

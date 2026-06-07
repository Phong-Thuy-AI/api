import crypto from 'crypto'

/**
 * Sinh mã nạp tiền đối soát chuyển khoản dạng TOPUPYYYYMMDDRANDOM
 */
export function generateTopupCode(): string {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `TOPUP${datePart}${randomPart}`
}

/**
 * Sinh mã OTP số ngẫu nhiên theo độ dài mong muốn (mặc định 6 số)
 */
export function generateOTP(length = 6): string {
  return String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, '0')
}

import solarLunar from 'solarlunar';

const CAN_MAP: Record<string, string> = {
  '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu',
  '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý'
};

const CHI_MAP: Record<string, string> = {
  '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn', '巳': 'Tỵ',
  '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu', '戌': 'Tuất', '亥': 'Hợi'
};

const CHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const TRUCS = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thu', 'Khai', 'Bế'];

const HOANG_DAO_MAP: Record<number, string[]> = {
  1: ['子', '丑', '巳', '未'],
  7: ['子', '丑', '巳', '未'],
  2: ['寅', '卯', '未', '酉'],
  8: ['寅', '卯', '未', '酉'],
  3: ['辰', '巳', '酉', '亥'],
  9: ['辰', '巳', '酉', '亥'],
  4: ['午', '未', '丑', '酉'],
  10: ['午', '未', '丑', '酉'],
  5: ['申', '酉', '丑', '卯'],
  11: ['申', '酉', '丑', '卯'],
  6: ['戌', '亥', '卯', '巳'],
  12: ['戌', '亥', '卯', '巳']
};

export interface ICTDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Trích xuất các thành phần ngày giờ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - ICT)
 */
export function getICTParts(date: Date = new Date()): ICTDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  return {
    year: parseInt(getPart('year'), 10),
    month: parseInt(getPart('month'), 10),
    day: parseInt(getPart('day'), 10),
    hour: parseInt(getPart('hour'), 10),
    minute: parseInt(getPart('minute'), 10),
    second: parseInt(getPart('second'), 10)
  };
}

/**
 * Lấy chuỗi ngày định dạng YYYY-MM-DD theo múi giờ ICT
 */
export function getICTDateString(date: Date = new Date()): string {
  const { year, month, day } = getICTParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Lấy chuỗi ngày định dạng DD/MM/YYYY theo múi giờ ICT
 */
export function getICTDateStrVN(date: Date = new Date()): string {
  const { year, month, day } = getICTParts(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export interface LunarDetails {
  lunarDateStr: string;     // e.g., "18/05/2026"
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  isLeap: boolean;
  canChiYear: string;       // e.g., "Bính Ngọ"
  canChiMonth: string;      // e.g., "Giáp Ngọ"
  canChiDay: string;        // e.g., "Đinh Sửu"
  truc: string;             // e.g., "Nguy"
  dayRating: string;        // e.g., "Hoàng đạo" | "Hắc đạo"
}

function translateGanZhi(gzStr: string): string {
  if (!gzStr || gzStr.length !== 2) return gzStr || '';
  const can = CAN_MAP[gzStr[0]] || gzStr[0];
  const chi = CHI_MAP[gzStr[1]] || gzStr[1];
  return `${can} ${chi}`;
}

function calculateTruc(monthGz: string, dayGz: string): string {
  if (!monthGz || !dayGz || monthGz.length !== 2 || dayGz.length !== 2) return '';
  const monthChi = monthGz[1];
  const dayChi = dayGz[1];
  const mIndex = CHIS.indexOf(monthChi);
  const dIndex = CHIS.indexOf(dayChi);
  if (mIndex === -1 || dIndex === -1) return '';
  const trucIndex = (dIndex - mIndex + 12) % 12;
  return TRUCS[trucIndex];
}

function getDayRating(lMonth: number, dayGz: string): string {
  if (!dayGz || dayGz.length !== 2) return 'Bình thường';
  const dayChi = dayGz[1];
  const hoangDaoDays = HOANG_DAO_MAP[lMonth] || [];
  return hoangDaoDays.includes(dayChi) ? 'Hoàng đạo' : 'Hắc đạo';
}

/**
 * Tính toán chi tiết thông tin lịch âm và can chi từ ngày dương lịch (ICT)
 */
export function getLunarDetails(date: Date = new Date()): LunarDetails {
  const { year, month, day } = getICTParts(date);
  
  // Tương thích giữa các môi trường biên dịch (Jest / Production runtime)
  const lib = (solarLunar as any).solar2lunar ? solarLunar : (solarLunar as any).default;
  const res = lib.solar2lunar(year, month, day);

  const lDay = res.lDay;
  const lMonth = res.lMonth;
  const lYear = res.lYear;
  const isLeap = !!res.isLeap;

  return {
    lunarDateStr: `${String(lDay).padStart(2, '0')}/${String(lMonth).padStart(2, '0')}/${lYear}${isLeap ? ' (Nhuận)' : ''}`,
    lunarDay: lDay,
    lunarMonth: lMonth,
    lunarYear: lYear,
    isLeap,
    canChiYear: translateGanZhi(res.gzYear),
    canChiMonth: translateGanZhi(res.gzMonth),
    canChiDay: translateGanZhi(res.gzDay),
    truc: calculateTruc(res.gzMonth, res.gzDay),
    dayRating: getDayRating(lMonth, res.gzDay)
  };
}

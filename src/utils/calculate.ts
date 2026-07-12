export interface NguHanhResult {
  score: number;       // Điểm ngũ hành (0, 20, 40, 50)
  c_sinh: number;      // Số chữ số tương sinh
  c_hop: number;       // Số chữ số tương hỗ / tương hợp
  c_khac: number;      // Số chữ số tương khắc
  rating: 'Đạt' | 'Đạt (Trội)' | 'Biến động lớn' | 'Không đạt';
  details: string;     // Diễn giải chi tiết bằng tiếng Việt
}

export interface NguHanhDeepInsight {
  mainLifeElement: string;
  periods: NguHanhDeepInsightPeriod[];
}

export interface NguHanhDeepInsightPeriod {
  key: 'tienVan' | 'trungVan' | 'hauVan';
  label: string;
  digits: string;
  notes: NguHanhDeepInsightNote[];
}

export interface NguHanhDeepInsightNote {
  code: string;
  matched: string;
  title: string;
  description: string;
}
export interface VanQueResult {
  score: number;       // Điểm vận quẻ (0, 20, 25, 50)
  rating: 'Cát' | 'Khuyên đổi SIM' | 'Khuyên bỏ SIM' | 'Ổn nhưng điểm thấp' | 'Không tốt';
  tienVanQue: number;
  trungVanQue: number;
  hauVanQue: number;
  tienVanClassification: string;
  trungVanClassification: string;
  hauVanClassification: string;
  details: string;     // Diễn giải chi tiết
}

/**
 * Xác định Mệnh người dùng dựa trên ngày sinh Dương lịch (YYYY-MM-DD).
 * Có tính đến các khoảng ngày giao mùa thuộc hành Thổ.
 */
export function calculateMenh(dob: string): 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ' {
  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    throw new Error('Ngày sinh không hợp lệ');
  }
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Xác định khoảng giao mùa Thổ (đã sửa từ 21/06-10/07 thành 21/07-10/08)
  const isTho = 
    (month === 3 && day >= 21) || (month === 4 && day <= 10) ||
    (month === 7 && day >= 21) || (month === 8 && day <= 10) ||
    (month === 9 && day >= 21) || (month === 10 && day <= 10) ||
    (month === 12 && day >= 21) || (month === 1 && day <= 10);

  if (isTho) return 'Thổ';

  // Các khoảng ngày còn lại cho 4 mệnh
  if ((month === 1 && day >= 11) || month === 2 || (month === 3 && day <= 20)) {
    return 'Mộc';
  }
  if ((month === 4 && day >= 11) || month === 5 || month === 6) { // Toàn bộ tháng 6
    return 'Hỏa';
  }
  if (
    (month === 7 && day <= 20) ||
    (month === 8 && day >= 11) ||
    (month === 9 && day <= 20)
  ) { // 01/07-20/07 và 11/08-20/09
    return 'Kim';
  }
  if ((month === 10 && day >= 11) || month === 11 || (month === 12 && day <= 20)) {
    return 'Thủy';
  }

  throw new Error('Không thể xác định mệnh do sai ngày tháng');
}

/**
 * Tính Mệnh theo năm sinh (Mệnh Niên / Can Chi)
 */
export function calculateMenhNien(dob: string): 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ' {
  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    throw new Error('Ngày sinh không hợp lệ');
  }
  const year = date.getFullYear();
  
  // Giá trị Can: Giáp/Ất = 1, Bính/Đinh = 2, Mậu/Kỷ = 3, Canh/Tân = 4, Nhâm/Quý = 5
  const canValues = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]; // index 0-9 tương ứng Giáp-Quý
  const canIndex = (year - 4) % 10;
  const canVal = canValues[canIndex >= 0 ? canIndex : canIndex + 10];

  // Giá trị Chi: Tý/Sửu/Ngọ/Mùi = 0, Dần/Mão/Thân/Dậu = 1, Thìn/Tỵ/Tuất/Hợi = 2
  const chiValues = [0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2]; // index 0-11 tương ứng Tý-Hợi
  const chiIndex = (year - 4) % 12;
  const chiVal = chiValues[chiIndex >= 0 ? chiIndex : chiIndex + 12];

  let menhVal = canVal + chiVal;
  if (menhVal > 5) menhVal -= 5;

  const menhMap: Record<number, 'Kim' | 'Thủy' | 'Hỏa' | 'Thổ' | 'Mộc'> = {
    1: 'Kim',
    2: 'Thủy',
    3: 'Hỏa',
    4: 'Thổ',
    5: 'Mộc'
  };

  return menhMap[menhVal];
}

/**
 * Tính điểm tương hợp Ngũ hành dựa trên toàn bộ số điện thoại.
 * Thang điểm tối đa 50.
 */
export function calculateNguHanhSim(phone: string, menh: 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ'): NguHanhResult {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    throw new Error('Số điện thoại đầu vào phải có tối thiểu 6 chữ số để chấm điểm');
  }
  const analyzeDigits = cleanPhone;

  // Quy đổi ngũ hành của số
  // Kim: 4, 6
  // Mộc: 3, 7
  // Thủy: 0, 1
  // Hỏa: 9
  // Thổ: 2, 5, 8
  const getDigitHanh = (digit: string): 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ' | '' => {
    if (['4', '6'].includes(digit)) return 'Kim';
    if (['3', '7'].includes(digit)) return 'Mộc';
    if (['0', '1'].includes(digit)) return 'Thủy';
    if (digit === '9') return 'Hỏa';
    if (['2', '5', '8'].includes(digit)) return 'Thổ';
    return '';
  };

  let c_sinh = 0;
  let c_hop = 0;
  let c_khac = 0;

  for (const digit of analyzeDigits) {
    const digitHanh = getDigitHanh(digit);
    if (!digitHanh) continue;

    // Quan hệ ngũ hành tương quan với mệnh người dùng
    if (digitHanh === menh) {
      c_hop++;
    } else {
      // Tương sinh
      const isSinh = 
        (menh === 'Kim' && digitHanh === 'Thổ') ||
        (menh === 'Thủy' && digitHanh === 'Kim') ||
        (menh === 'Mộc' && digitHanh === 'Thủy') ||
        (menh === 'Hỏa' && digitHanh === 'Mộc') ||
        (menh === 'Thổ' && digitHanh === 'Hỏa');
      
      // Tương khắc
      const isKhac = 
        (menh === 'Kim' && digitHanh === 'Hỏa') ||
        (menh === 'Thủy' && digitHanh === 'Thổ') ||
        (menh === 'Mộc' && digitHanh === 'Kim') ||
        (menh === 'Hỏa' && digitHanh === 'Thủy') ||
        (menh === 'Thổ' && digitHanh === 'Mộc');

      if (isSinh) c_sinh++;
      else if (isKhac) c_khac++;
    }
  }

  let score = 0;
  let rating: NguHanhResult['rating'] = 'Không đạt';
  let details = '';

  if (c_sinh + c_hop > c_khac && c_sinh > c_khac && c_khac === 0) {
    score = 50;
    rating = 'Đạt';
    details = `SIM có sự phối hợp Ngũ hành rất tốt với mệnh ${menh}: có ${c_sinh} số tương sinh, ${c_hop} số tương hợp và hoàn toàn không bị khắc chế (0 số khắc).`;
  } else if (c_sinh + c_hop > c_khac && c_sinh > c_khac && c_khac > 0) {
    score = 40;
    rating = 'Đạt (Trội)';
    details = `SIM đạt yêu cầu hợp mệnh ${menh}: lượng số sinh (${c_sinh} số) và hợp (${c_hop} số) vẫn chiếm ưu thế vượt trội so với ${c_khac} số khắc.`;
  } else if (c_sinh === c_khac && c_sinh > 0) {
    score = 20;
    rating = 'Biến động lớn';
    details = `SIM này thể hiện sự biến động lớn đối với mệnh ${menh}: số tương sinh (${c_sinh}) cân bằng với số tương khắc (${c_khac}), cuộc đời dễ gặp thăng trầm biến động, tài lộc lúc tụ lúc tán nhanh.`;
  } else {
    score = 0;
    rating = 'Không đạt';
    details = `SIM không hợp mệnh ${menh}: số lượng tương khắc (${c_khac} số) chiếm ưu thế hơn so với lượng số sinh và hợp (${c_sinh + c_hop} số).`;
  }

  return { score, c_sinh, c_hop, c_khac, rating, details };
}

type NguHanhElement = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

function getDigitNguHanh(digit: string): NguHanhElement | null {
  if (digit === '4' || digit === '6') return 'Kim';
  if (digit === '3' || digit === '7') return 'Mộc';
  if (digit === '0' || digit === '1') return 'Thủy';
  if (digit === '9') return 'Hỏa';
  if (digit === '2' || digit === '5' || digit === '8') return 'Thổ';
  return null;
}

/**
 * Ghi nhận các điểm nhấn chiêm nghiệm theo cặp số.
 * Không chấm điểm, không đảo chiều cặp số: chỉ đọc đúng thứ tự trái sang phải.
 */
export function calculateNguHanhDeepInsight(phone: string, mainLifeElement: string): NguHanhDeepInsight {
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneLast6 = cleanPhone.slice(-6);

  const periods: Array<Omit<NguHanhDeepInsightPeriod, 'notes'>> = [
    {
      key: 'tienVan',
      label: 'Tiền vận',
      digits: cleanPhone.length > 2 ? cleanPhone.slice(0, -2) : cleanPhone
    },
    {
      key: 'trungVan',
      label: 'Trung vận',
      digits: phoneLast6.substring(1, 5)
    },
    {
      key: 'hauVan',
      label: 'Hậu vận',
      digits: phoneLast6.substring(2, 6)
    }
  ];

  const pairNotes: Record<string, Omit<NguHanhDeepInsightNote, 'matched'>> = {
    '07': {
      code: 'WATER_WOOD_07',
      title: 'Thủy sinh Mộc',
      description: 'Dòng tiền sinh sôi, có tín hiệu nuôi dưỡng tài lộc và mở rộng cơ hội.'
    },
    '03': {
      code: 'WATER_WOOD_03',
      title: 'Thủy sinh Mộc',
      description: 'Dòng tiền sinh sôi, phù hợp câu chuyện bùng nổ tài lộc và tăng trưởng.'
    },
    '17': {
      code: 'WATER_WOOD_17',
      title: 'Thủy sinh Mộc',
      description: 'Dòng tiền sinh sôi, dễ tạo đà phát triển và chuyển hóa tích cực.'
    },
    '13': {
      code: 'WATER_WOOD_13',
      title: 'Thủy sinh Mộc',
      description: 'Dòng tiền sinh sôi, có điểm nhấn về tài lộc phát triển theo hướng bền dần.'
    },
    '69': {
      code: 'LEADERSHIP_69',
      title: 'Kim Hỏa',
      description: 'Tín hiệu quyết đoán, lãnh đạo, uy tín và sức ảnh hưởng với người khác.'
    },
    '49': {
      code: 'LEADERSHIP_49',
      title: 'Kim Hỏa',
      description: 'Tín hiệu quyết đoán, lãnh đạo, uy tín và sức ảnh hưởng với người khác.'
    },
    '78': {
      code: 'WOOD_EARTH_78',
      title: 'Mộc Thổ',
      description: 'Tín hiệu sinh trưởng, nuôi dưỡng, tạo nền để tích lũy và phát triển.'
    }
  };

  const buildPeriodNotes = (digits: string): NguHanhDeepInsightNote[] => {
    const notes: NguHanhDeepInsightNote[] = [];

    Object.entries(pairNotes).forEach(([pair, note]) => {
      if (digits.includes(pair)) {
        notes.push({ ...note, matched: pair });
      }
    });

    if (digits.includes('8')) {
      notes.push({
        code: 'WEALTH_STORAGE_8',
        matched: '8',
        title: 'Kho chứa tài sản',
        description: 'Có tín hiệu giữ tiền, tích lũy và tạo nền tài sản.'
      });
    }

    const healthCycle = findContinuousGeneratingCycle(digits);
    if (healthCycle) {
      notes.push({
        code: 'HEALTH_FULL_GENERATING_CYCLE',
        matched: healthCycle,
        title: 'Sức khỏe có dòng tương sinh đủ 5 hành',
        description: 'Ngũ hành vận hành liên tục đủ 5 hành, là điểm nhấn về sinh khí và sự cân bằng.'
      });
    }

    return notes;
  };

  return {
    mainLifeElement,
    periods: periods.map(period => ({
      ...period,
      notes: buildPeriodNotes(period.digits)
    }))
  };
}

function findContinuousGeneratingCycle(digits: string): string | null {
  const cycle: NguHanhElement[] = ['Thủy', 'Mộc', 'Hỏa', 'Thổ', 'Kim'];
  const digitElements = digits
    .split('')
    .map(digit => ({ digit, element: getDigitNguHanh(digit) }))
    .filter((item): item is { digit: string; element: NguHanhElement } => Boolean(item.element));

  for (let start = 0; start <= digitElements.length - cycle.length; start++) {
    for (let offset = 0; offset < cycle.length; offset++) {
      const expected = cycle.map((_, index) => cycle[(offset + index) % cycle.length]);
      const actual = digitElements.slice(start, start + cycle.length).map(item => item.element);
      if (expected.every((element, index) => element === actual[index])) {
        return digitElements.slice(start, start + cycle.length).map(item => item.digit).join('');
      }
    }
  }

  return null;
}
/**
 * Tính toán 3 Vận quẻ SIM (Tiền/Trung/Hậu vận) từ 6 số cuối.
 * Áp dụng các luật ưu tiên ghi đè cát hung.
 * Thang điểm tối đa 50.
 */
export function calculateVanQueSim(
  phone: string,
  usedLessThan6Months: boolean,
  classifications: { tien: string; trung: string; hau: string }
): VanQueResult {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    throw new Error('Số điện thoại đầu vào phải có tối thiểu 6 chữ số đuôi để chấm điểm');
  }
  const phoneLast6 = cleanPhone.slice(-6);

  // 1. Cắt chuỗi 6 số cuối thành 3 vận
  const tienVanStr = phoneLast6.substring(0, 4);  // 4 số đầu
  const trungVanStr = phoneLast6.substring(1, 5); // 4 số giữa
  const hauVanStr = phoneLast6.substring(2, 6);   // 4 số cuối

  // Tính số quẻ bằng giá trị nguyên của chuỗi 4 số % 80.
  const calculateQueNumber = (str: string): number => {
    const mod = parseInt(str, 10) % 80;
    return mod === 0 ? 80 : mod;
  };

  const tienVanQue = calculateQueNumber(tienVanStr);
  const trungVanQue = calculateQueNumber(trungVanStr);
  const hauVanQue = calculateQueNumber(hauVanStr);

  const normalizeClassification = (classification: string): string =>
    classification
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/đ/g, 'd')
      .toUpperCase();

  const tienClass = normalizeClassification(classifications.tien);
  const trungClass = normalizeClassification(classifications.trung);
  const hauClass = normalizeClassification(classifications.hau);

  const getPeriodScore = (classification: string, maxScore: 15 | 20): number => {
    if (classification.includes('DAI CAT')) return maxScore === 20 ? 15 : 10;
    if (classification === 'CAT') return 5;
    return 0;
  };

  const tienBasic = getPeriodScore(tienClass, 15);
  const trungBasic = getPeriodScore(trungClass, 15);
  const hauBasic = getPeriodScore(hauClass, 20);

  let score = tienBasic + trungBasic + hauBasic;

  let rating: VanQueResult['rating'] = 'Không tốt';
  let details = '';

  const isHung = (cls: string) => cls.includes('DAI HUNG') || cls === 'HUNG';

  // 2. Áp dụng quy tắc ghi đè (Overrides)
  
  // Quy tắc Hậu vận (Trọng yếu): Hậu vận bị Hung / Đại Hung -> 0 điểm, Khuyên bỏ SIM
  if (isHung(hauClass)) {
    score = 0;
    rating = 'Khuyên bỏ SIM';
    details = `Cảnh báo đặc biệt: Hậu vận của SIM thuộc quẻ xấu (${classifications.hau}). Hậu vận là giai đoạn thu hoạch tích lũy cuối cùng, nếu gặp vận Hung/Đại Hung thì dù các vận trước tốt đến mấy vẫn khuyên nên bỏ sử dụng SIM này.`;
  }
  // Quy tắc Tiền vận: Thời gian dùng SIM dưới 6 tháng & Tiền vận bị Hung / Đại Hung -> 0 điểm, Khuyên đổi SIM
  else if (usedLessThan6Months && isHung(tienClass)) {
    score = 0;
    rating = 'Khuyên đổi SIM';
    details = `Cảnh báo: Thời gian dùng SIM dưới 6 tháng và Tiền vận gặp quẻ xấu (${classifications.tien}). Vì bạn đang ở giai đoạn đầu chịu năng lượng trực tiếp từ Tiền vận xấu, khuyên bạn nên đổi SIM sớm để tránh xui xẻo.`;
  }
  // Trường hợp tính điểm bình thường không bị ghi đè
  else {
    if (score >= 40) {
      rating = 'Cát';
      details = `Vận quẻ của SIM rất tốt, mang năng lượng cát tường bổ trợ cuộc sống: Tiền vận [${classifications.tien}], Trung vận [${classifications.trung}], Hậu vận [${classifications.hau}].`;
    } else if (score >= 20) {
      rating = 'Ổn nhưng điểm thấp';
      details = `Vận quẻ của SIM ở mức trung bình tạm ổn: Tiền vận [${classifications.tien}], Trung vận [${classifications.trung}], Hậu vận [${classifications.hau}].`;
    } else {
      rating = 'Không tốt';
      details = `Vận quẻ của SIM chứa nhiều năng lượng suy thoái, bất lợi: Tiền vận [${classifications.tien}], Trung vận [${classifications.trung}], Hậu vận [${classifications.hau}].`;
    }
  }

  return {
    score,
    rating,
    tienVanQue,
    trungVanQue,
    hauVanQue,
    tienVanClassification: classifications.tien,
    trungVanClassification: classifications.trung,
    hauVanClassification: classifications.hau,
    details
  };
}



export interface PinnacleInfo {
  age: number;
  value: number;
}

export interface NumerologyPinnacles {
  p1: PinnacleInfo;
  p2: PinnacleInfo;
  p3: PinnacleInfo;
  p4: PinnacleInfo;
}

export interface NameNumbers {
  expression: number;
  soulUrge: number;
  personality: number;
}

export interface PersonalVibrations {
  personalYear: number;
  personalMonth: number;
  personalDay: number;
}

export interface CurrentPinnacle {
  phase: number;
  age: number;
  value: number;
}

const letterMap: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9
};

const vowels = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

/**
 * Rút gọn số thành một chữ số (1-9)
 */
export function reduceToSingleDigit(num: number): number {
  let temp = num;
  while (temp > 9) {
    temp = String(temp).split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  }
  return temp;
}

/**
 * Tính Con số chủ đạo (Life Path) từ ngày sinh dạng "YYYY-MM-DD"
 * Giữ lại các số chủ đạo đặc biệt: 10, 11, 22.
 * Trả về cả chỉ số gốc và chỉ số đã rút gọn về 1-9 để tính đỉnh cao.
 */
export function calculateLifePath(dobStr: string): { lifePath: number; reducedLifePath: number } {
  const clean = dobStr.replace(/\D/g, '');
  if (!clean) {
    throw new Error('Ngày sinh không hợp lệ hoặc rỗng');
  }

  let sum = 0;
  for (const char of clean) {
    sum += parseInt(char, 10);
  }

  let temp = sum;
  while (temp > 9) {
    if (temp === 10 || temp === 11 || temp === 22) {
      break;
    }
    temp = String(temp).split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  }

  const lifePath = temp;

  // Rút gọn về 1-9 cho việc tính mốc đỉnh cao
  let reducedLifePath = lifePath;
  if (reducedLifePath === 10) reducedLifePath = 1;
  else if (reducedLifePath === 11) reducedLifePath = 2;
  else if (reducedLifePath === 22) reducedLifePath = 4;

  return { lifePath, reducedLifePath };
}

/**
 * Tính các chỉ số Thần số học từ Họ và Tên: Sứ mệnh, Linh hồn, Nhân cách
 * Rút gọn giữ lại các số master: 11, 22, 33.
 */
export function calculateNameNumbers(name: string): NameNumbers {
  const cleanName = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();

  let sumExpression = 0;
  let sumSoulUrge = 0;
  let sumPersonality = 0;

  for (const char of cleanName) {
    const val = letterMap[char] || 0;
    sumExpression += val;
    if (vowels.has(char)) {
      sumSoulUrge += val;
    } else {
      sumPersonality += val;
    }
  }

  const reduceNameNumber = (num: number): number => {
    let temp = num;
    while (temp > 9) {
      if (temp === 11 || temp === 22 || temp === 33) {
        break;
      }
      temp = String(temp).split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
    }
    return temp;
  };

  return {
    expression: reduceNameNumber(sumExpression),
    soulUrge: reduceNameNumber(sumSoulUrge),
    personality: reduceNameNumber(sumPersonality)
  };
}

/**
 * Tính 4 đỉnh cao cuộc đời từ ngày sinh "YYYY-MM-DD"
 */
export function calculatePinnacles(dobStr: string, reducedLifePath: number): NumerologyPinnacles {
  const parts = dobStr.split('-');
  if (parts.length < 3) {
    throw new Error('Định dạng ngày sinh phải là YYYY-MM-DD');
  }

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);

  const rDay = reduceToSingleDigit(birthDay);
  const rMonth = reduceToSingleDigit(birthMonth);

  let yearSum = 0;
  for (const char of String(birthYear)) {
    yearSum += parseInt(char, 10);
  }
  const rYear = reduceToSingleDigit(yearSum);

  const p1Age = 36 - reducedLifePath;
  const p2Age = p1Age + 9;
  const p3Age = p2Age + 9;
  const p4Age = p3Age + 9;

  const p1Value = reduceToSingleDigit(rDay + rMonth);
  const p2Value = reduceToSingleDigit(rDay + rYear);
  const p3Value = reduceToSingleDigit(p1Value + p2Value);
  const p4Value = reduceToSingleDigit(rMonth + rYear);

  return {
    p1: { age: p1Age, value: p1Value },
    p2: { age: p2Age, value: p2Value },
    p3: { age: p3Age, value: p3Value },
    p4: { age: p4Age, value: p4Value }
  };
}

/**
 * Xác định giai đoạn Đỉnh cao hiện tại của người dùng đối với ngày đích (targetDate)
 */
export function getCurrentPinnacle(
  dobStr: string,
  reducedLifePath: number,
  targetDate: Date
): CurrentPinnacle {
  const parts = dobStr.split('-');
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);

  let age = targetDate.getFullYear() - birthYear;
  if (
    targetDate.getMonth() + 1 < birthMonth ||
    (targetDate.getMonth() + 1 === birthMonth && targetDate.getDate() < birthDay)
  ) {
    age--;
  }

  const pinnacles = calculatePinnacles(dobStr, reducedLifePath);

  if (age < pinnacles.p1.age) {
    return { phase: 1, age: pinnacles.p1.age, value: pinnacles.p1.value };
  } else if (age < pinnacles.p2.age) {
    return { phase: 2, age: pinnacles.p2.age, value: pinnacles.p2.value };
  } else if (age < pinnacles.p3.age) {
    return { phase: 3, age: pinnacles.p3.age, value: pinnacles.p3.value };
  } else {
    return { phase: 4, age: pinnacles.p4.age, value: pinnacles.p4.value };
  }
}

/**
 * Tính toán Năm, Tháng, Ngày cá nhân (Personal Year, Month, Day) cho một ngày nhất định
 */
export function calculatePersonalVibrations(
  dobStr: string,
  targetDate: Date
): PersonalVibrations {
  const parts = dobStr.split('-');
  if (parts.length < 3) {
    throw new Error('Định dạng ngày sinh phải là YYYY-MM-DD');
  }

  const dobMonth = parseInt(parts[1], 10);
  const dobDay = parseInt(parts[2], 10);

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1; // 1-12
  const targetDay = targetDate.getDate();

  const rDobDay = reduceToSingleDigit(dobDay);
  const rDobMonth = reduceToSingleDigit(dobMonth);
  const rTargetYear = reduceToSingleDigit(targetYear);

  const personalYear = reduceToSingleDigit(rDobDay + rDobMonth + rTargetYear);
  const personalMonth = reduceToSingleDigit(personalYear + reduceToSingleDigit(targetMonth));
  const personalDay = reduceToSingleDigit(personalMonth + reduceToSingleDigit(targetDay));

  return { personalYear, personalMonth, personalDay };
}

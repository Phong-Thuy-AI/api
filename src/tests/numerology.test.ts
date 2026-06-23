import { describe, test, expect } from '@jest/globals';
import {
  calculateLifePath,
  calculateNameNumbers,
  calculatePinnacles,
  getCurrentPinnacle,
  calculatePersonalVibrations,
  reduceToSingleDigit
} from '../utils/numerology';

describe('Kiểm thử Dịch vụ Thần số học - utils/numerology.ts', () => {
  
  test('reduceToSingleDigit - Rút gọn số thành một chữ số chính xác', () => {
    expect(reduceToSingleDigit(34)).toBe(7);
    expect(reduceToSingleDigit(19)).toBe(1);
    expect(reduceToSingleDigit(999)).toBe(9); // 9+9+9 = 27 -> 2+7 = 9
    expect(reduceToSingleDigit(9)).toBe(9);
  });

  test('calculateLifePath - Tính Con số chủ đạo chính xác', () => {
    // 15/10/1998 -> 1+5+1+0+1+9+9+8 = 34 -> 7
    const result1 = calculateLifePath('1998-10-15');
    expect(result1.lifePath).toBe(7);
    expect(result1.reducedLifePath).toBe(7);

    // 18/07/1977 -> 1+8+0+7+1+9+7+7 = 40 -> 4
    const result2 = calculateLifePath('1977-07-18');
    expect(result2.lifePath).toBe(4);
    expect(result2.reducedLifePath).toBe(4);

    // Test trường hợp đặc biệt 10: 15/05/1979 -> 1+5+0+5+1+9+7+9 = 37 -> 10
    const result3 = calculateLifePath('1979-05-15');
    expect(result3.lifePath).toBe(10);
    expect(result3.reducedLifePath).toBe(1);

    // Test trường hợp đặc biệt 11: 30/08/1989 -> 3+0+0+8+1+9+8+9 = 38 -> 11
    const result4 = calculateLifePath('1989-08-30');
    expect(result4.lifePath).toBe(11);
    expect(result4.reducedLifePath).toBe(2);
  });

  test('calculateNameNumbers - Tính các chỉ số từ Họ và Tên (bao gồm số master)', () => {
    // Tên: "PHAN HOANG TIEN"
    // P=7, H=8, A=1, N=5, H=8, O=6, A=1, N=5, G=7, T=2, I=9, E=5, N=5
    // Sum = 70. 7+0 = 7.
    // Nguyên âm: A(1), O(6), A(1), I(9), E(5) -> Sum = 22 (master)
    // Phụ âm: P(7), H(8), N(5), H(8), G(7), T(2), N(5) -> Sum = 42 -> 6
    const nameNumbers = calculateNameNumbers('Phan Hoàng Tiến');
    
    expect(nameNumbers.expression).toBe(6);
    expect(nameNumbers.soulUrge).toBe(22);
    expect(nameNumbers.personality).toBe(11);
  });

  test('calculatePinnacles - Tính tuổi và giá trị 4 đỉnh cao cuộc đời chính xác', () => {
    // 15/10/1998, lifePath = 7 -> reduced = 7
    // Tuổi mốc: P1: 36-7=29, P2: 29+9=38, P3: 38+9=47, P4: 47+9=56
    // Ngày: 15 -> 6. Tháng: 10 -> 1. Năm: 1998 -> 27 -> 9.
    // P1 = 6 + 1 = 7
    // P2 = 6 + 9 = 15 -> 6
    // P3 = P1 + P2 = 7 + 6 = 13 -> 4
    // P4 = 1 + 9 = 10 -> 1
    const pinnacles = calculatePinnacles('1998-10-15', 7);

    expect(pinnacles.p1.age).toBe(29);
    expect(pinnacles.p1.value).toBe(7);

    expect(pinnacles.p2.age).toBe(38);
    expect(pinnacles.p2.value).toBe(6);

    expect(pinnacles.p3.age).toBe(47);
    expect(pinnacles.p3.value).toBe(4);

    expect(pinnacles.p4.age).toBe(56);
    expect(pinnacles.p4.value).toBe(1);
  });

  test('getCurrentPinnacle - Xác định đúng đỉnh cao cuộc đời hiện tại', () => {
    // 15/10/1998, reducedLifePath = 7
    // P1 mốc tuổi: 29 tuổi.
    // Nếu targetDate là 2026-06-23 -> người đó 27 tuổi -> Đang ở Đỉnh 1
    const pinnacleAt27 = getCurrentPinnacle('1998-10-15', 7, new Date('2026-06-23'));
    expect(pinnacleAt27.phase).toBe(1);
    expect(pinnacleAt27.age).toBe(29);
    expect(pinnacleAt27.value).toBe(7);

    // Nếu targetDate là 2028-11-01 -> người đó 30 tuổi -> Đang ở Đỉnh 2 (30 nằm giữa 29 và 38)
    const pinnacleAt30 = getCurrentPinnacle('1998-10-15', 7, new Date('2028-11-01'));
    expect(pinnacleAt30.phase).toBe(2);
    expect(pinnacleAt30.age).toBe(38);
    expect(pinnacleAt30.value).toBe(6);
  });

  test('calculatePersonalVibrations - Tính đúng Năm/Tháng/Ngày cá nhân', () => {
    // Ngày sinh: 15/10/1998. Target: 23/06/2026.
    // rDobDay = 6, rDobMonth = 1. rTargetYear = 2026 -> 1.
    // personalYear = 6 + 1 + 1 = 8.
    // personalMonth = 8 + 6 = 14 -> 5.
    // personalDay = 5 + (2+3) = 10 -> 1.
    const vibrations = calculatePersonalVibrations('1998-10-15', new Date('2026-06-23'));

    expect(vibrations.personalYear).toBe(8);
    expect(vibrations.personalMonth).toBe(5);
    expect(vibrations.personalDay).toBe(1);
  });
});

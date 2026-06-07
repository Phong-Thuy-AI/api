import { describe, test, expect } from '@jest/globals';
import { calculateMenh, calculateNguHanhSim, calculateVanQueSim } from '@/utils/calculate';

describe('Thuật toán tính Mệnh - calculateMenh()', () => {
  test('Xác định mệnh Thổ (Ngày giao mùa)', () => {
    // 21/03 - 10/04 (giao mùa Xuân - Hạ)
    expect(calculateMenh('1995-03-21')).toBe('Thổ');
    expect(calculateMenh('1995-04-10')).toBe('Thổ');
    
    // 21/06 - 10/07 (giao mùa Hạ - Thu)
    expect(calculateMenh('1990-06-25')).toBe('Thổ');
    expect(calculateMenh('1990-07-10')).toBe('Thổ');

    // 21/09 - 10/10 (giao mùa Thu - Đông)
    expect(calculateMenh('2000-09-30')).toBe('Thổ');
    expect(calculateMenh('2000-10-05')).toBe('Thổ');

    // 21/12 - 10/01 (giao mùa Đông - Xuân)
    expect(calculateMenh('1988-12-21')).toBe('Thổ');
    expect(calculateMenh('1989-01-05')).toBe('Thổ');
  });

  test('Xác định các mệnh khác (Không phải ngày giao mùa)', () => {
    // Mộc: 11/01 - 20/03
    expect(calculateMenh('1995-01-11')).toBe('Mộc');
    expect(calculateMenh('1995-02-15')).toBe('Mộc');
    expect(calculateMenh('1995-03-20')).toBe('Mộc');

    // Hỏa: 11/04 - 20/06
    expect(calculateMenh('1995-04-11')).toBe('Hỏa');
    expect(calculateMenh('1995-05-20')).toBe('Hỏa');
    expect(calculateMenh('1995-06-20')).toBe('Hỏa');

    // Kim: 11/07 - 20/09
    expect(calculateMenh('1995-07-11')).toBe('Kim');
    expect(calculateMenh('1995-08-15')).toBe('Kim');
    expect(calculateMenh('1995-09-20')).toBe('Kim');

    // Thủy: 11/10 - 20/12
    expect(calculateMenh('1995-10-11')).toBe('Thủy');
    expect(calculateMenh('1995-11-15')).toBe('Thủy');
    expect(calculateMenh('1995-12-20')).toBe('Thủy');
  });

  test('Trả về lỗi khi định dạng ngày sinh sai', () => {
    expect(() => calculateMenh('invalid-date')).toThrow();
  });
});

describe('Thuật toán Ngũ hành SIM - calculateNguHanhSim()', () => {
  // Mệnh Kim tương sinh: Thổ (2, 5, 8); tương hợp: Kim (4, 6); tương khắc: Hỏa (9); trung tính: Thủy (0, 1), Mộc (3, 7)

  test('Đạt 50 điểm (Có số sinh + hợp, không có số khắc)', () => {
    // Số đuôi: 562482 -> Chứa Thổ (5, 2, 8, 2) và Kim (6, 4) -> 4 sinh, 2 hợp, 0 khắc
    const result = calculateNguHanhSim('0987562482', 'Kim');
    expect(result.score).toBe(50);
    expect(result.rating).toBe('Đạt');
    expect(result.c_sinh).toBe(4);
    expect(result.c_hop).toBe(2);
    expect(result.c_khac).toBe(0);
  });

  test('Đạt 40 điểm (Có số sinh + hợp nổi trội nhưng có số khắc)', () => {
    // Số đuôi: 569482 -> Chứa Thổ (5, 8, 2 - 3 sinh), Kim (6, 4 - 2 hợp), Hỏa (9 - 1 khắc)
    // Sinh + Hợp = 5 > 1 khắc; Sinh = 3 > 1 khắc; Khắc = 1 > 0 -> 40đ
    const result = calculateNguHanhSim('569482', 'Kim');
    expect(result.score).toBe(40);
    expect(result.rating).toBe('Đạt (Trội)');
    expect(result.c_sinh).toBe(3);
    expect(result.c_hop).toBe(2);
    expect(result.c_khac).toBe(1);
  });

  test('Biến động lớn (20 điểm) (Sinh = Khắc > 0)', () => {
    // Số đuôi: 593710 -> Chứa Thổ (5 - 1 sinh), Hỏa (9 - 1 khắc), Mộc (3, 7 - trung tính), Thủy (1, 0 - trung tính)
    // Sinh = 1, Khắc = 1 -> Sinh == Khắc -> 20đ
    const result = calculateNguHanhSim('593710', 'Kim');
    expect(result.score).toBe(20);
    expect(result.rating).toBe('Biến động lớn');
    expect(result.c_sinh).toBe(1);
    expect(result.c_khac).toBe(1);
  });

  test('Không đạt (0 điểm) (Khắc chiếm ưu thế)', () => {
    // Số đuôi: 999371 -> Chứa Hỏa (9, 9, 9 - 3 khắc), Mộc (3, 7 - trung tính), Thủy (1 - trung tính)
    // Sinh = 0, Hợp = 0, Khắc = 3 -> Khắc vượt trội -> 0đ
    const result = calculateNguHanhSim('999371', 'Kim');
    expect(result.score).toBe(0);
    expect(result.rating).toBe('Không đạt');
    expect(result.c_sinh).toBe(0);
    expect(result.c_hop).toBe(0);
    expect(result.c_khac).toBe(3);
  });

  test('Chỉ dùng 6 số cuối khi nhập số điện thoại đầy đủ', () => {
    const fullPhoneResult = calculateNguHanhSim('0900562482', 'Kim');
    const lastSixResult = calculateNguHanhSim('562482', 'Kim');

    expect(fullPhoneResult).toEqual(lastSixResult);
  });

  test('Trả lỗi khi đầu vào có ít hơn 6 chữ số', () => {
    expect(() => calculateNguHanhSim('12345', 'Kim')).toThrow();
  });
});

describe('Thuật toán Vận quẻ SIM - calculateVanQueSim()', () => {
  // Lấy 6 số đuôi: 123456
  // Tiền vận (4 số đầu): 1234 -> 1234 % 80 = 34
  // Trung vận (4 số giữa): 2345 -> 2345 % 80 = 25
  // Hậu vận (4 số cuối): 3456 -> 3456 % 80 = 16

  test('Tính đúng số quẻ dịch (Modulo 80)', () => {
    const result = calculateVanQueSim('123456', false, {
      tien: 'CÁT',
      trung: 'BÁN CÁT',
      hau: 'CÁT'
    });
    expect(result.tienVanQue).toBe(34);
    expect(result.trungVanQue).toBe(25);
    expect(result.hauVanQue).toBe(16);
  });

  test('Chỉ dùng 6 số cuối khi nhập số điện thoại đầy đủ', () => {
    const fullPhoneResult = calculateVanQueSim('0900123456', false, {
      tien: 'CÁT',
      trung: 'BÁN CÁT',
      hau: 'CÁT'
    });
    const lastSixResult = calculateVanQueSim('123456', false, {
      tien: 'CÁT',
      trung: 'BÁN CÁT',
      hau: 'CÁT'
    });

    expect(fullPhoneResult.tienVanQue).toBe(lastSixResult.tienVanQue);
    expect(fullPhoneResult.trungVanQue).toBe(lastSixResult.trungVanQue);
    expect(fullPhoneResult.hauVanQue).toBe(lastSixResult.hauVanQue);
  });

  test('Trả lỗi khi đầu vào có ít hơn 6 chữ số', () => {
    expect(() => calculateVanQueSim('12345', false, {
      tien: 'CÁT',
      trung: 'CÁT',
      hau: 'CÁT'
    })).toThrow();
  });

  test('Chấm điểm cơ bản thành công (Không kích hoạt luật ghi đè)', () => {
    // Tiền: CÁT (16.67đ), Trung: BÁN CÁT (8.33đ), Hậu: CÁT (16.67đ) -> Tổng: 41.67đ
    const result = calculateVanQueSim('123456', false, {
      tien: 'CÁT',
      trung: 'BÁN CÁT',
      hau: 'CÁT'
    });
    expect(result.score).toBe(41.67);
    expect(result.rating).toBe('Cát');
  });

  test('Quy tắc Hậu vận (Trọng yếu) - Hậu vận Hung -> 0 điểm, Khuyên bỏ SIM', () => {
    // Bất kể Tiền và Trung cát thế nào, nếu Hậu vận Hung -> 0đ, Khuyên bỏ SIM
    const result = calculateVanQueSim('123456', false, {
      tien: 'ĐẠI CÁT',
      trung: 'ĐẠI CÁT',
      hau: 'ĐẠI HUNG'
    });
    expect(result.score).toBe(0);
    expect(result.rating).toBe('Khuyên bỏ SIM');
  });

  test('Quy tắc Tiền vận - Dùng dưới 6 tháng & Tiền vận Hung -> 0 điểm, Khuyên đổi SIM', () => {
    // Dùng dưới 6 tháng, Tiền vận Đại Hung, Hậu vận Cát -> 0đ, Khuyên đổi SIM
    const result = calculateVanQueSim('123456', true, {
      tien: 'ĐẠI HUNG',
      trung: 'CÁT',
      hau: 'CÁT'
    });
    expect(result.score).toBe(0);
    expect(result.rating).toBe('Khuyên đổi SIM');
  });

  test('Quy tắc Tiền vận - Dùng trên 6 tháng & Tiền vận Hung -> Bỏ qua luật sập điểm, tính điểm bình thường', () => {
    // Dùng trên 6 tháng, Tiền vận Đại Hung (0đ), Trung vận Cát (16.67đ), Hậu vận Cát (16.67đ) -> 33.34đ
    const result = calculateVanQueSim('123456', false, {
      tien: 'ĐẠI HUNG',
      trung: 'CÁT',
      hau: 'CÁT'
    });
    expect(result.score).toBe(33.34);
    expect(result.rating).toBe('Ổn nhưng điểm thấp');
  });

  test('Quy tắc Trung vận bị Hung nhưng Hậu vận Cát -> Gán cố định 20 điểm, Ổn nhưng điểm thấp', () => {
    // Tiền: CÁT, Trung: HUNG, Hậu: CÁT -> Thỏa mãn điều kiện ghi đè -> Gán cố định 20đ
    const result = calculateVanQueSim('123456', false, {
      tien: 'CÁT',
      trung: 'HUNG',
      hau: 'CÁT'
    });
    expect(result.score).toBe(20);
    expect(result.rating).toBe('Ổn nhưng điểm thấp');
  });
});

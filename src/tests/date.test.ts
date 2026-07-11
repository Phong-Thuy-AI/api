import { describe, test, expect } from '@jest/globals';
import { getICTParts, getICTDateString, getICTDateStrVN, getLunarDetails } from '@/utils/date';

describe('Kiểm thử múi giờ Việt Nam (ICT) - date utils', () => {
  test('getICTParts chuyển đổi chính xác mốc thời gian UTC sang ICT', () => {
    // 2026-07-11T17:00:00.000Z tương đương 2026-07-12T00:00:00+07:00 (Nửa đêm ngày 12)
    const date = new Date('2026-07-11T17:00:00.000Z');
    const parts = getICTParts(date);
    
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(7);
    expect(parts.day).toBe(12);
    expect(parts.hour).toBe(0);
    expect(parts.minute).toBe(0);
    expect(parts.second).toBe(0);
  });

  test('getICTDateString trả về YYYY-MM-DD chuẩn ICT', () => {
    // 2026-07-11T17:00:00.000Z -> "2026-07-12"
    const date1 = new Date('2026-07-11T17:00:00.000Z');
    expect(getICTDateString(date1)).toBe('2026-07-12');

    // 2026-07-11T16:59:59.000Z -> "2026-07-11" (lúc 23:59:59 ngày 11 ICT)
    const date2 = new Date('2026-07-11T16:59:59.000Z');
    expect(getICTDateString(date2)).toBe('2026-07-11');
  });

  test('getICTDateStrVN trả về DD/MM/YYYY chuẩn ICT', () => {
    const date = new Date('2026-07-11T17:00:00.000Z');
    expect(getICTDateStrVN(date)).toBe('12/07/2026');
  });
});

describe('Kiểm thử chuyển đổi Lịch Âm & Can Chi & Trực', () => {
  test('Tính chính xác thông tin ngày Đinh Sửu 02/07/2026 dương lịch', () => {
    const date = new Date('2026-07-02T12:00:00Z'); // Ngày 02/07/2026
    const lunar = getLunarDetails(date);

    expect(lunar.lunarDateStr).toBe('18/05/2026');
    expect(lunar.lunarDay).toBe(18);
    expect(lunar.lunarMonth).toBe(5);
    expect(lunar.lunarYear).toBe(2026);
    expect(lunar.isLeap).toBe(false);

    expect(lunar.canChiYear).toBe('Bính Ngọ');
    expect(lunar.canChiMonth).toBe('Giáp Ngọ');
    expect(lunar.canChiDay).toBe('Đinh Sửu');

    expect(lunar.truc).toBe('Nguy');
    expect(lunar.dayRating).toBe('Hoàng đạo');
  });
});

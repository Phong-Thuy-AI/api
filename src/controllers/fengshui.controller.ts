import { Request, Response } from 'express';
import { User, Hexagram, SimCheckEvent } from '@/models';
import { calculateMenh, calculateMenhNien, calculateNguHanhDeepInsight, calculateNguHanhSim, calculateVanQueSim } from '@/utils/calculate';
import { signToken } from '@/utils/jwt';
import { sendSuccess } from '@/utils/response';
import { generateSimAnalysis } from '@/services/ai.service';
import { sendSimReport } from '@/services/email.service';

/**
 * Sinh mã giới thiệu gốc từ họ tên và 2 số cuối SĐT
 * Spec: "Nguyễn Văn An, SĐT đuôi 88 → NVA88"
 */
function generateBaseReferralCode(name: string, phone: string): string {
  const cleanName = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z\s]/g, '');

  const words = cleanName.trim().split(/\s+/);
  const initials = words.map(w => w.charAt(0).toUpperCase()).join('');

  const phoneLast2 = phone.slice(-2);

  return `${initials}${phoneLast2}`;
}

/**
 * Đảm bảo mã giới thiệu là duy nhất (Phương án A - thêm số thứ tự)
 */
async function getUniqueReferralCode(baseCode: string): Promise<string> {
  let uniqueCode = baseCode;
  let counter = 0;
  while (true) {
    const existing = await User.findOne({ where: { referralCode: uniqueCode } });
    if (!existing) break;
    counter++;
    uniqueCode = `${baseCode}${counter}`;
  }
  return uniqueCode;
}

function getOverallRating(totalScore: number): string {
  if (totalScore >= 80) return 'Tot';
  if (totalScore >= 65) return 'Kha';
  if (totalScore >= 50) return 'Trung binh';
  return 'Can xem lai';
}

function summarizeNguHanhDeepInsight(deepInsight: ReturnType<typeof calculateNguHanhDeepInsight>): string {
  const lines = deepInsight.periods.flatMap(period =>
    period.notes.map(note => `- ${period.label} (${period.digits}): ${note.matched} - ${note.title}. ${note.description}`)
  );

  return lines.length > 0
    ? lines.join('\n')
    : 'Không ghi nhận điểm nhấn cặp số rõ theo catalog hệ thống.';
}
/**
 * Gọi AI với timeout tối đa 50 giây, trả null nếu quá thời gian hoặc lỗi
 */
async function tryGenerateAnalysis(params: Parameters<typeof generateSimAnalysis>[0]): Promise<string | null> {
  const startTime = Date.now();
  console.log(`[AI] === Bắt đầu gọi AI phân tích SIM ===`);
  console.log(`[AI] Thông tin: name=${params.name}, phoneLast6=${params.hexHau ? 'có' : 'không'}, menh=${params.menh}`);

  let isTimeout = false;
  const timeoutPromise = new Promise<null>(resolve => 
    setTimeout(() => {
      isTimeout = true;
      resolve(null);
    }, 120000)
  );

  try {
    const result = await Promise.race([generateSimAnalysis(params), timeoutPromise]);
    const duration = Date.now() - startTime;

    if (isTimeout) {
      console.warn(`[AI] ❌ QUÁ THỜI GIAN CHỜ (TIMEOUT): Cuộc gọi AI vượt quá 120 giây.`);
      return null;
    }

    if (!result) {
      console.error(`[AI] ❌ THẤT BẠI: AI phản hồi rỗng (null) hoặc gặp lỗi kết nối. Thời gian chạy: ${duration}ms`);
    } else {
      console.log(`[AI] ✅ THÀNH CÔNG: Đã nhận phản hồi từ AI. Thời gian chạy: ${duration}ms, độ dài phản hồi: ${result.length} ký tự`);
    }

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AI] ❌ LỖI trong quá trình gọi AI (sau ${duration}ms):`, error.message || error);
    return null;
  }
}

/**
 * API Chấm điểm SIM & Tạo/Cập nhật User Session
 * POST /api/v1/fengshui/check
 */
export async function checkFengShuiSim(req: Request, res: Response) {
  const {
    name,
    email,
    phone,
    dob,
    tob,
    usedLessThan6Months,
    focusArea,
    referredByCode
  } = req.body;

  // 1. Validate các trường dữ liệu
  if (!name || !phone || !dob || usedLessThan6Months === undefined) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.'
    };
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Địa chỉ email không đúng định dạng.'
      };
    }
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Số điện thoại phải chứa tối thiểu 6 chữ số.'
    };
  }

  if (focusArea) {
    const validFocusAreas = ['Gia đạo', 'Tình duyên', 'Sức khỏe', 'Công việc', 'Công danh', 'Sự nghiệp'];
    if (!validFocusAreas.includes(focusArea)) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Vấn đề cần cải vận không hợp lệ.'
      };
    }
  }

  // 1.5. Kiểm tra giới hạn lượt check (tối đa 5 lần/người)
  const existingUserForPhone = await User.findOne({ where: { phone: cleanPhone } });
  if (!existingUserForPhone) {
    const checkCount = await User.count({
      where: {
        name,
        dob: dob
      }
    });
    if (checkCount >= 5) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Bạn đã vượt quá giới hạn kiểm tra SIM phong thủy (tối đa 5 lần cho cùng một thông tin cá nhân).'
      };
    }
  }

  // 2. Tính toán phong thủy
  const menh = calculateMenh(dob); // Mệnh theo ngày tháng (mùa sinh)
  const menhNien = calculateMenhNien(dob); // Mệnh theo năm (tuổi)

  const nguHanhResultNgayThang = calculateNguHanhSim(cleanPhone, menh);
  const nguHanhResultNien = calculateNguHanhSim(cleanPhone, menhNien);

  const combinedDetails = `Mệnh theo năm sinh (${menhNien}): ${nguHanhResultNien.details}\nMệnh theo ngày tháng sinh (${menh}): ${nguHanhResultNgayThang.details}`;

  const nguHanhResult = {
    score: nguHanhResultNgayThang.score,
    c_sinh: nguHanhResultNgayThang.c_sinh,
    c_hop: nguHanhResultNgayThang.c_hop,
    c_khac: nguHanhResultNgayThang.c_khac,
    rating: nguHanhResultNgayThang.rating,
    details: combinedDetails
  };
  const nguHanhDeepInsight = calculateNguHanhDeepInsight(cleanPhone, menh);
  const nguHanhDeepInsightSummary = summarizeNguHanhDeepInsight(nguHanhDeepInsight);

  const phoneLast6 = cleanPhone.slice(-6);
  const tienVanStr = phoneLast6.substring(0, 4);
  const trungVanStr = phoneLast6.substring(1, 5);
  const hauVanStr = phoneLast6.substring(2, 6);

  const calculateQueNumber = (str: string): number => {
    const mod = parseInt(str, 10) % 80;
    return mod === 0 ? 80 : mod;
  };

  const tienVanQue = calculateQueNumber(tienVanStr);
  const trungVanQue = calculateQueNumber(trungVanStr);
  const hauVanQue = calculateQueNumber(hauVanStr);

  const hexagrams = await Hexagram.findAll({
    where: { id: [tienVanQue, trungVanQue, hauVanQue] }
  });
  const hexMap = new Map(hexagrams.map(h => [h.id, h]));
  const tienHex = hexMap.get(tienVanQue);
  const trungHex = hexMap.get(trungVanQue);
  const hauHex = hexMap.get(hauVanQue);

  if (!tienHex || !trungHex || !hauHex) {
    throw {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Không tìm thấy dữ liệu quẻ dịch trong hệ thống. Vui lòng liên hệ quản trị viên.'
    };
  }

  const vanQueResult = calculateVanQueSim(phoneLast6, usedLessThan6Months, {
    tien: tienHex.classification,
    trung: trungHex.classification,
    hau: hauHex.classification
  });

  const totalScore = nguHanhResult.score + vanQueResult.score;

  // 3. Tìm hoặc Tạo mới User (lưu cả focusArea + kết quả luận giải)
  const checkResultJson = JSON.stringify({
    menh,
    nguHanh: {
      score: nguHanhResult.score,
      c_sinh: nguHanhResult.c_sinh,
      c_hop: nguHanhResult.c_hop,
      c_khac: nguHanhResult.c_khac,
      rating: nguHanhResult.rating,
      details: nguHanhResult.details,
      deepInsight: nguHanhDeepInsight
    },
    vanQue: {
      score: vanQueResult.score,
      rating: vanQueResult.rating,
      tienVanQue: vanQueResult.tienVanQue,
      trungVanQue: vanQueResult.trungVanQue,
      hauVanQue: vanQueResult.hauVanQue,
      details: vanQueResult.details
    },
    totalScore,
    hexagrams: {
      cleaned: {
        tien: tienHex.cleanedText,
        trung: trungHex.cleanedText,
        hau: hauHex.cleanedText
      }
    }
  });

  let user = await User.findOne({ where: { phone: cleanPhone } });
  if (user) {
    user.name = name;
    user.email = email ? email.trim() : null;
    user.phone = cleanPhone;
    user.dob = new Date(dob);
    user.tob = tob || '';
    user.menh = menh;
    user.focusArea = focusArea || null;
    user.lastCheckResult = checkResultJson;
    if (referredByCode && !user.referredByCode) {
      user.referredByCode = referredByCode;
    }
    await user.save();
  } else {
    user = await User.create({
      name,
      email: email ? email.trim() : null,
      phone: cleanPhone,
      dob: new Date(dob),
      tob: tob || '',
      menh,
      focusArea: focusArea || null,
      lastCheckResult: checkResultJson,
      referralCode: null,
      referredByCode: referredByCode || null
    });
  }

  // 4. Đặt cookie session `user_token` HttpOnly
  SimCheckEvent.create({
    userId: user.id,
    phoneLast4: cleanPhone.slice(-4),
    totalScore,
    rating: getOverallRating(totalScore),
    focusArea: focusArea || null,
    referredByCode: referredByCode || user.referredByCode || null
  }).catch(err => console.error('[Analytics] Failed to track SIM check:', err));

  const token = signToken({ userId: user.id, role: 'user' }, '30d');
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('user_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  // 5. Gọi AI luận giải (tối đa 15s, best-effort)
  const aiAnalysis = await tryGenerateAnalysis({
    name,
    dob,
    tob,
    menh,
    menhNien,
    focusArea,
    usedLessThan6Months,
    nguHanhScore: nguHanhResult.score,
    nguHanhDetails: nguHanhResult.details,
    nguHanhDeepInsightSummary,
    vanQueScore: vanQueResult.score,
    vanQueDetails: vanQueResult.details,
    totalScore,
    hexTien: tienHex.cleanedText,
    hexTrung: trungHex.cleanedText,
    hexHau: hauHex.cleanedText
  });

  // 6. Nếu AI trả về kết quả → cập nhật lastCheckResult với aiAnalysis + gửi email
  if (aiAnalysis) {
    const fullResult = JSON.parse(checkResultJson);
    fullResult.aiAnalysis = aiAnalysis;
    user.lastCheckResult = JSON.stringify(fullResult);
    user.save().catch(err => console.error('[Fengshui] Update lastCheckResult error:', err));

    if (user.email) {
      sendSimReport(user.email, user.name, aiAnalysis).catch(err =>
        console.error('[Email] sendSimReport error:', err)
      );
    }
  }

  // 7. Trả kết quả
  return sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      dob: user.dob,
      tob: user.tob,
      menh: user.menh,
      focusArea: user.focusArea,
      referralCode: user.referralCode,
      referredByCode: user.referredByCode
    },
    result: {
      menh,
      menhNien,
      nguHanh: {
        score: nguHanhResult.score,
        c_sinh: nguHanhResult.c_sinh,
        c_hop: nguHanhResult.c_hop,
        c_khac: nguHanhResult.c_khac,
        rating: nguHanhResult.rating,
        details: nguHanhResult.details,
        deepInsight: nguHanhDeepInsight
      },
      vanQue: {
        score: vanQueResult.score,
        rating: vanQueResult.rating,
        tienVanQue: vanQueResult.tienVanQue,
        trungVanQue: vanQueResult.trungVanQue,
        hauVanQue: vanQueResult.hauVanQue,
        details: vanQueResult.details
      },
      totalScore,
      hexagrams: {
        cleaned: {
          tien: tienHex.cleanedText,
          trung: trungHex.cleanedText,
          hau: hauHex.cleanedText
        }
      },
      aiAnalysis
    }
  }, 'Kiểm tra SIM phong thủy thành công.');
}



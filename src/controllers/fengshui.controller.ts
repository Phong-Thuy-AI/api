import { Request, Response } from 'express';
import { User, Hexagram } from '@/models';
import { calculateMenh, calculateNguHanhSim, calculateVanQueSim } from '@/utils/calculate';
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

/**
 * Gọi AI với timeout tối đa 15 giây, trả null nếu quá thời gian hoặc lỗi
 */
async function tryGenerateAnalysis(params: Parameters<typeof generateSimAnalysis>[0]): Promise<string | null> {
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 15000));
  return Promise.race([generateSimAnalysis(params), timeout]);
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
  if (!name || !email || !phone || !dob || !tob || usedLessThan6Months === undefined || !focusArea) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Địa chỉ email không đúng định dạng.'
    };
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Số điện thoại phải chứa tối thiểu 6 chữ số.'
    };
  }

  const validFocusAreas = ['Gia đạo', 'Tình duyên', 'Công việc', 'Công danh', 'Sự nghiệp'];
  if (!validFocusAreas.includes(focusArea)) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Vấn đề cần cải vận không hợp lệ.'
    };
  }

  // 2. Tính toán phong thủy
  const menh = calculateMenh(dob);
  const nguHanhResult = calculateNguHanhSim(cleanPhone, menh);

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
      details: nguHanhResult.details
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

  let user = await User.findOne({ where: { email } });
  if (user) {
    user.name = name;
    user.phone = cleanPhone;
    user.dob = new Date(dob);
    user.tob = tob;
    user.menh = menh;
    user.focusArea = focusArea;
    user.lastCheckResult = checkResultJson;
    if (referredByCode && !user.referredByCode) {
      user.referredByCode = referredByCode;
    }
    await user.save();
  } else {
    const baseCode = generateBaseReferralCode(name, cleanPhone);
    const referralCode = await getUniqueReferralCode(baseCode);

    user = await User.create({
      name,
      email,
      phone: cleanPhone,
      dob: new Date(dob),
      tob,
      menh,
      focusArea,
      lastCheckResult: checkResultJson,
      referralCode,
      referredByCode: referredByCode || null
    });
  }

  // 4. Đặt cookie session `user_token` HttpOnly
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
    menh,
    focusArea,
    usedLessThan6Months,
    nguHanhScore: nguHanhResult.score,
    nguHanhDetails: nguHanhResult.details,
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

    sendSimReport(user.email, user.name, aiAnalysis).catch(err =>
      console.error('[Email] sendSimReport error:', err)
    );
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
      nguHanh: {
        score: nguHanhResult.score,
        c_sinh: nguHanhResult.c_sinh,
        c_hop: nguHanhResult.c_hop,
        c_khac: nguHanhResult.c_khac,
        rating: nguHanhResult.rating,
        details: nguHanhResult.details
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

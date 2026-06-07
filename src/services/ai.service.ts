import axios from 'axios';
import { SystemConfig } from '@/models';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

/**
 * Lấy API key theo thứ tự ưu tiên:
 * 1. Key admin cấu hình trong bảng system_configs
 * 2. Fallback về GEMINI_API_KEY trong .env
 */
async function getActiveApiKey(): Promise<string | null> {
  try {
    const config = await SystemConfig.findByPk('GEMINI_API_KEY');
    if (config?.value) return config.value;
  } catch {
    // DB lỗi, tiếp tục fallback
  }
  return process.env.GEMINI_API_KEY || null;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await axios.post<GeminiResponse>(
    `${GEMINI_API_URL}?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 600
      }
    },
    { timeout: 25000 }
  );
  return response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────────────────────
// Prompt Template 1: Luận giải kết quả SIM phong thủy
// ─────────────────────────────────────────────────────────────

export interface SimAnalysisParams {
  name: string;
  dob: string;
  menh: string;
  focusArea: string;
  usedLessThan6Months: boolean;
  nguHanhScore: number;
  nguHanhDetails: string;
  vanQueScore: number;
  vanQueDetails: string;
  totalScore: number;
  hexTien: string;
  hexTrung: string;
  hexHau: string;
}

export async function generateSimAnalysis(params: SimAnalysisParams): Promise<string | null> {
  const apiKey = await getActiveApiKey();
  if (!apiKey) return null;

  const duration = params.usedLessThan6Months ? 'Dưới 6 tháng' : 'Trên 6 tháng';

  const prompt = `Bạn là chuyên gia phong thủy Á Đông. Hãy phân tích và luận giải báo cáo phong thủy SIM điện thoại bằng tiếng Việt, ngôn ngữ gần gũi, tích cực.

**Thông tin người dùng:**
- Họ tên: ${params.name}
- Ngày sinh: ${params.dob}
- Mệnh: ${params.menh}
- Vấn đề cần cải vận: ${params.focusArea}
- Thời gian sử dụng SIM: ${duration}

**Điểm số:**
- Ngũ hành (${params.nguHanhScore}/50): ${params.nguHanhDetails}
- Vận quẻ (${params.vanQueScore}/50): ${params.vanQueDetails}
- Tổng: ${params.totalScore}/100

**Nội dung 3 Vận quẻ:**
- Tiền vận: ${params.hexTien}
- Trung vận: ${params.hexTrung}
- Hậu vận: ${params.hexHau}

Viết 1 đoạn phân tích (150-200 từ), tập trung vào "${params.focusArea}". Không đề cập số thứ tự quẻ hay tên Hán-Việt. Kết thúc bằng 1 lời khuyên thiết thực cụ thể.`;

  try {
    return await callGemini(prompt, apiKey);
  } catch (err) {
    console.error('[AI] generateSimAnalysis error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Prompt Template 2: Tử vi nhắc vận hằng ngày
// ─────────────────────────────────────────────────────────────

export async function generateDailyHoroscope(
  menh: string,
  focusArea: string,
  dateStr: string
): Promise<string | null> {
  const apiKey = await getActiveApiKey();
  if (!apiKey) return null;

  const prompt = `Bạn là thầy phong thủy Á Đông. Viết bản tử vi nhắc vận khí ngắn gọn bằng tiếng Việt cho ngày ${dateStr}.

Đối tượng: Người mệnh ${menh}, tập trung cải vận về ${focusArea}.

Yêu cầu:
- Viết 1 đoạn 80-120 từ, tích cực và mang tính khuyến khích
- Gợi ý 1-2 hành động cụ thể cho ngày hôm nay liên quan đến ${focusArea}
- Ngôn ngữ thân thiện, không dùng thuật ngữ khó, không đề cập số quẻ hay tên Hán-Việt`;

  try {
    return await callGemini(prompt, apiKey);
  } catch (err) {
    console.error(`[AI] generateDailyHoroscope error (${menh}/${focusArea}):`, err);
    return null;
  }
}

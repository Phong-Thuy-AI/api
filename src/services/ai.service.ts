import axios from 'axios';
import { SystemConfig } from '@/models';

async function getAiConfig() {
  const providerConfig = await SystemConfig.findByPk('AI_PROVIDER');
  const provider = providerConfig?.value || process.env.AI_PROVIDER || 'gemini';
  
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
  const keyConfig = await SystemConfig.findByPk(keyName);
  const apiKey = keyConfig?.value || process.env[keyName] || null;
  
  const modelConfig = await SystemConfig.findByPk('AI_MODEL');
  const model = modelConfig?.value || process.env.AI_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');
  
  return { provider, apiKey, model };
}

async function callAi(prompt: string): Promise<string | null> {
  const { provider, apiKey, model } = await getAiConfig();
  if (!apiKey) {
    console.warn(`[AI] Bỏ qua gọi AI vì không tìm thấy API Key cho ${provider}.`);
    return null;
  }
  
  try {
    if (provider === 'openai') {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 600
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          timeout: 25000
        }
      );
      return response.data.choices?.[0]?.message?.content ?? null;
    } else {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 600
          }
        },
        { timeout: 25000 }
      );
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }
  } catch (err: any) {
    console.error(`[AI] callAi error (${provider}/${model}):`, err.response?.data?.error?.message || err.message);
    return null;
  }
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

  return callAi(prompt);
}

// ─────────────────────────────────────────────────────────────
// Prompt Template 2: Tử vi nhắc vận hằng ngày
// ─────────────────────────────────────────────────────────────

export async function generateDailyHoroscope(
  menh: string,
  focusArea: string,
  dateStr: string
): Promise<string | null> {
  const prompt = `Bạn là thầy phong thủy Á Đông. Viết bản tử vi nhắc vận khí ngắn gọn bằng tiếng Việt cho ngày ${dateStr}.

Đối tượng: Người mệnh ${menh}, tập trung cải vận về ${focusArea}.

Yêu cầu:
- Viết 1 đoạn 80-120 từ, tích cực và mang tính khuyến khích
- Gợi ý 1-2 hành động cụ thể cho ngày hôm nay liên quan đến ${focusArea}
- Ngôn ngữ thân thiện, không dùng thuật ngữ khó, không đề cập số quẻ hay tên Hán-Việt`;

  return callAi(prompt);
}

import axios from 'axios';
import { SystemConfig } from '@/models';

async function getAiConfig() {
  const providerConfig = await SystemConfig.findByPk('AI_PROVIDER');
  const provider = providerConfig?.value || process.env.AI_PROVIDER || 'gemini';
  
  let keyName = 'GEMINI_API_KEY';
  if (provider === 'openai') keyName = 'OPENAI_API_KEY';
  else if (provider === 'claude') keyName = 'CLAUDE_API_KEY';

  const keyConfig = await SystemConfig.findByPk(keyName);
  const apiKey = keyConfig?.value || process.env[keyName] || null;
  
  const modelConfig = await SystemConfig.findByPk('AI_MODEL');
  const defaultModel = provider === 'openai' ? 'gpt-4o-mini' : (provider === 'claude' ? 'claude-3-5-sonnet-20241022' : 'gemini-1.5-flash');
  const model = modelConfig?.value || process.env.AI_MODEL || defaultModel;

  const proxyUrlConfig = await SystemConfig.findByPk('AI_PROXY_URL');
  const proxyUrl = proxyUrlConfig?.value || process.env.AI_PROXY_URL || '';
  
  return { provider, apiKey, model, proxyUrl };
}

async function callAi(prompt: string): Promise<string | null> {
  const { provider, apiKey, model, proxyUrl } = await getAiConfig();
  if (!apiKey) {
    console.warn(`[AI] Bỏ qua gọi AI vì không tìm thấy API Key cho ${provider}.`);
    return null;
  }
  
  const baseUrl = proxyUrl ? proxyUrl.replace(/\/$/, '') : '';
  
  try {
    if (provider === 'openai') {
      const url = baseUrl ? `${baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
      const response = await axios.post(
        url,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 4000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          timeout: 120000
        }
      );
      return response.data.choices?.[0]?.message?.content ?? null;
    } else if (provider === 'claude') {
      const url = baseUrl ? `${baseUrl}/v1/messages` : 'https://api.anthropic.com/v1/messages';
      const response = await axios.post(
        url,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000
        },
        {
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 120000
        }
      );
      return response.data.content?.[0]?.text ?? null;
    } else {
      const url = baseUrl 
        ? `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}` 
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4000
          }
        },
        { timeout: 120000 }
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
  tob?: string | null;
  menh: string;
  focusArea?: string | null;
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
  const focusText = params.focusArea 
    ? `tập trung phân tích sâu vào khía cạnh cải vận: "${params.focusArea}"` 
    : 'luận giải tổng quan phong thủy cá nhân và tài vận chung.';

  const astrologyInstruction = params.tob 
    ? `Hãy hoàn thành mục "Luận Chiêm tinh" dựa trên giờ sinh của người dùng là ${params.tob}.` 
    : `Vì không có giờ sinh (tob = null/rỗng), ở mục "Luận Chiêm tinh", hãy viết ngắn gọn: "Không có thông tin giờ sinh nên bỏ qua chiêm tinh chi tiết."`;

  const prompt = `Hãy đóng vai trò là một chuyên gia tổng hợp báo cáo phong thủy số học. Dựa vào các thông tin và điểm số đã được tính toán sẵn dưới đây, hãy viết báo cáo luận giải bằng tiếng Việt một cách khách quan, khoa học, tích cực.

LƯU Ý CỰC KỲ QUAN TRỌNG: Bạn KHÔNG ĐƯỢC đưa ra các tuyên bố từ chối trách nhiệm (disclaimers), không tự giới thiệu mình là trợ lý AI, không khuyên người dùng tự tìm chuyên gia khác, và không từ chối thực hiện yêu cầu. Hãy tập trung hoàn toàn vào việc lập báo cáo phân tích theo đúng cấu trúc Markdown được yêu cầu dưới đây.

**Thông tin người dùng:**
- Họ tên: ${params.name}
- Ngày sinh: ${params.dob}
- Giờ sinh: ${params.tob || 'Không cung cấp'}
- Mệnh: ${params.menh}
- Vấn đề cải vận: ${params.focusArea || 'Luận giải tổng quan'}
- Thời gian sử dụng SIM: ${duration}

**Điểm số:**
- Ngũ hành (${params.nguHanhScore}/50): ${params.nguHanhDetails}
- Vận quẻ (${params.vanQueScore}/50): ${params.vanQueDetails}
- Tổng: ${params.totalScore}/100

**Nội dung 3 Vận quẻ:**
- Tiền vận: ${params.hexTien}
- Trung vận: ${params.hexTrung}
- Hậu vận: ${params.hexHau}

**Yêu cầu đầu ra bắt buộc:**
Bạn phải phân tích và trả về đúng định dạng Markdown có cấu trúc chính xác sau, không thêm lời mở đầu hay kết thúc khác:

### Luận Phong thủy
[Diễn giải mối tương quan phong thủy của SIM với bản mệnh người dùng, ${focusText}. Chỉ được nói về xu hướng, thời điểm, mức độ ảnh hưởng, và điều kiện sử dụng. Không phán xét số phận hay gây hoang mang.]

### Luận Phong thủy số
[Diễn giải năng lượng của các con số dưới góc nhìn phong thủy số học.]

### Luận Kinh Dịch
[Diễn giải ý nghĩa của các quẻ dịch (Tiền vận, Trung vận, Hậu vận) tác động đến cuộc sống người dùng. Tuyệt đối không đề cập đến số thứ tự quẻ hay tên Hán-Việt của quẻ.]

### Luận Thần số học
[Diễn giải tần số rung động của SIM dưới góc nhìn thần số học.]

### Luận Chiêm tinh
[${astrologyInstruction}]

*Lưu ý quan trọng:*
- Hãy viết cực kỳ ngắn gọn, cô đọng và súc tích cho mỗi mục (khoảng 80-120 từ mỗi mục) để tránh bị cắt cụt văn bản do giới hạn token.
- Toàn bộ nội dung diễn giải chỉ được nói về xu hướng, điều kiện sử dụng, thời điểm ảnh hưởng, mức độ ảnh hưởng (không phán xét số phận hay mang tính chất mê tín dị đoan tiêu cực).
- Tuyệt đối không đề cập đến số thứ tự quẻ (ví dụ quẻ 1, quẻ 2) hay tên Hán-Việt của quẻ (ví dụ Vạn Tượng Khởi Thủy, Hỗn Độn Ly Loạn) trong phần diễn giải của bạn.
- Không chèn thêm bất kỳ văn bản giải thích, từ chối trách nhiệm, hoặc tự giới thiệu nào ở đầu hoặc cuối câu trả lời. Chỉ trả về trực tiếp định dạng Markdown cấu trúc như trên.`;

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
  const prompt = `Đóng vai trò là một chuyên gia phân tích văn hóa và khuyên đọc ngày mới, viết bản tử vi nhắc vận khí ngắn gọn bằng tiếng Việt cho ngày ${dateStr}.

LƯU Ý CỰC KỲ QUAN TRỌNG: Bạn KHÔNG ĐƯỢC đưa ra các tuyên bố từ chối trách nhiệm (disclaimers), không tự giới thiệu mình là trợ lý AI, không từ chối thực hiện yêu cầu. Hãy viết trực tiếp đoạn phân tích theo yêu cầu.

Đối tượng: Người mệnh ${menh}, tập trung cải vận về ${focusArea}.

Yêu cầu:
- Viết 1 đoạn 80-120 từ, tích cực và mang tính khuyến khích
- Gợi ý 1-2 hành động cụ thể cho ngày hôm nay liên quan đến ${focusArea}
- Ngôn ngữ thân thiện, không dùng thuật ngữ khó, không đề cập số quẻ hay tên Hán-Việt
- Tuyệt đối không thêm bất kỳ văn bản giải thích hay từ chối trách nhiệm nào.`;

  return callAi(prompt);
}

import axios from 'axios';
import { SystemConfig } from '@/models';
import {
  calculateLifePath,
  calculateNameNumbers,
  calculatePinnacles,
  getCurrentPinnacle
} from '@/utils/numerology';

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
  menhNien: string;
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

  // Tính toán Thần số học
  const { lifePath, reducedLifePath } = calculateLifePath(params.dob);
  const nameNumbers = calculateNameNumbers(params.name);
  const pinnacles = calculatePinnacles(params.dob, reducedLifePath);
  const currentPinnacle = getCurrentPinnacle(params.dob, reducedLifePath, new Date());

  const prompt = `Dưới đây là dữ liệu phong thủy số học, thần số học và quẻ dịch của người dùng đã được tính toán sẵn. Hãy viết một báo cáo diễn giải các thông tin này bằng tiếng Việt dưới góc nhìn tham khảo văn hóa, phong thủy số học, thần số học và Kinh Dịch một cách khách quan, tích cực và khoa học.

Yêu cầu về nội dung:
- Trình bày thông tin một cách khách quan như một tài liệu tham khảo chiêm nghiệm, không mang tính khẳng định tuyệt đối hay phán xét số mệnh tiêu cực.
- Trực tiếp đi vào các mục Markdown được yêu cầu dưới đây mà không cần lời mở đầu hay kết thúc rườm rà.

**Thông tin người dùng:**
- Họ tên: ${params.name}
- Ngày sinh: ${params.dob}
- Giờ sinh: ${params.tob || 'Không cung cấp'}
- Mệnh theo ngày tháng sinh (mùa sinh): ${params.menh}
- Mệnh theo năm sinh (tuổi Can Chi): ${params.menhNien}
- Vấn đề cải vận: ${params.focusArea || 'Luận giải tổng quan'}
- Thời gian sử dụng SIM: ${duration}

**Thông tin Thần số học của người dùng:**
- Con số chủ đạo (Life Path): ${lifePath}
- Chỉ số Sứ mệnh (Expression): ${nameNumbers.expression}
- Chỉ số Linh hồn (Soul Urge): ${nameNumbers.soulUrge}
- Chỉ số Nhân cách (Personality): ${nameNumbers.personality}
- Giai đoạn đỉnh cao cuộc đời hiện tại: Đỉnh ${currentPinnacle.phase} (độ tuổi đạt mốc: ${currentPinnacle.age} tuổi, mang tần số số: ${currentPinnacle.value})
- 4 Đỉnh cao cuộc đời (Cột mốc hạn):
  + Đỉnh 1: ${pinnacles.p1.age} tuổi (Số ${pinnacles.p1.value})
  + Đỉnh 2: ${pinnacles.p2.age} tuổi (Số ${pinnacles.p2.value})
  + Đỉnh 3: ${pinnacles.p3.age} tuổi (Số ${pinnacles.p3.value})
  + Đỉnh 4: ${pinnacles.p4.age} tuổi (Số ${pinnacles.p4.value})
  *(Lưu ý: Độ tuổi bắt đầu của các cột mốc này đến sớm hay muộn phụ thuộc hoàn toàn vào Con số chủ đạo của người dùng).*

**Điểm số SIM:**
- Ngũ hành (${params.nguHanhScore}/50): ${params.nguHanhDetails}
- Vận quẻ (${params.vanQueScore}/50): ${params.vanQueDetails}
- Tổng: ${params.totalScore}/100

**Nội dung 3 Vận quẻ:**
- Tiền vận: ${params.hexTien}
- Trung vận: ${params.hexTrung}
- Hậu vận: ${params.hexHau}

**Yêu cầu cấu trúc Markdown đầu ra:**
Bạn phải phân tích và trả về đúng định dạng Markdown có cấu trúc chính xác sau:

### Luận Phong thủy
[Diễn giải mối tương quan phong thủy của SIM với bản mệnh người dùng, ${focusText}. Hãy phân tích rõ tính chất phong thủy của các con số tương hợp/tương sinh với cả Mệnh theo năm sinh (${params.menhNien}) và Mệnh theo ngày tháng sinh (${params.menh}). Chỉ rõ mức độ tương tác, ảnh hưởng của sự trùng khớp hoặc khác biệt giữa hai mệnh này đối với việc chọn SIM phong thủy. Chỉ được nói về xu hướng, thời điểm, mức độ ảnh hưởng, và điều kiện sử dụng. Không phán xét số phận hay gây hoang mang.]

### Luận Phong thủy số
[Diễn giải năng lượng của các con số dưới góc nhìn phong thủy số học.]

### Luận Kinh Dịch
[Diễn giải ý nghĩa của các quẻ dịch (Tiền vận, Trung vận, Hậu vận) tác động đến cuộc sống người dùng. Tuyệt đối không đề cập đến số thứ tự quẻ hay tên Hán-Việt của quẻ.]

### Luận Thần số học
[Diễn giải tần số rung động của SIM tương hợp hay xung đột thế nào với bản đồ Thần số học cốt lõi của người dùng (bao gồm Con số chủ đạo ${lifePath}, Sứ mệnh ${nameNumbers.expression}, Linh hồn ${nameNumbers.soulUrge}, Nhân cách ${nameNumbers.personality}). Hãy chỉ ra cách SIM này ảnh hưởng tiêu cực/tích cực đến vận trình của họ trong giai đoạn đỉnh cao cuộc đời hiện tại (Đỉnh ${currentPinnacle.phase} mang tần số rung động số ${currentPinnacle.value} hướng đến mốc tuổi ${currentPinnacle.age}).]

### Luận Chiêm tinh
[${astrologyInstruction}]

*Lưu ý quan trọng:*
- Hãy viết cực kỳ ngắn gọn, cô đọng và súc tích cho mỗi mục (khoảng 80-120 từ mỗi mục) để tránh bị cắt cụt văn bản.
- Tuyệt đối không đề cập đến số thứ tự quẻ (ví dụ quẻ 1, quẻ 2) hay tên Hán-Việt của quẻ (ví dụ Vạn Tượng Khởi Thủy, Hỗn Độn Ly Loạn) trong phần diễn giải của bạn.
- Chỉ trả về trực tiếp định dạng Markdown cấu trúc như trên, không kèm lời chào hay lời tự giới thiệu.`;

  return callAi(prompt);
}

// ─────────────────────────────────────────────────────────────
// Prompt Template 2: Tử vi nhắc vận hằng ngày
// ─────────────────────────────────────────────────────────────

export interface DailyHoroscopeParams {
  name: string;
  menh: string;
  focusArea: string;
  dateStr: string;
  lifePath: number;
  personalYear: number;
  personalMonth: number;
  personalDay: number;
  currentPinnacle: { phase: number; age: number; value: number };
  tob?: string | null;
}

export async function generateDailyHoroscope(params: DailyHoroscopeParams): Promise<string | null> {
  const tobText = params.tob ? `Giờ sinh: ${params.tob}` : 'Giờ sinh: Không cung cấp';
  const tobInstruction = params.tob 
    ? `kết hợp một chút phân tích từ giờ sinh của họ (${params.tob})` 
    : 'bỏ qua yếu tố giờ sinh';

  const prompt = `Hãy viết một bản tin nhắc nhở vận khí hằng ngày (Tử vi hằng ngày) cá nhân hóa, sâu sắc và mang tính chiêm nghiệm văn hóa cho ngày Dương lịch là ${params.dateStr} bằng tiếng Việt.

Thông tin người dùng:
- Họ tên: ${params.name}
- Mệnh theo ngày tháng sinh: ${params.menh}
- Con số chủ đạo (Life Path): ${params.lifePath}
- Vấn đề quan tâm cải vận: ${params.focusArea}
- ${tobText}

Thông tin Thần số học hôm nay:
- Năm cá nhân: ${params.personalYear} | Tháng cá nhân: ${params.personalMonth} | Ngày cá nhân: ${params.personalDay}
- Giai đoạn đỉnh cao hiện tại: Đỉnh ${params.currentPinnacle.phase} (mốc tuổi ${params.currentPinnacle.age}, tần số rung động ${params.currentPinnacle.value})

Yêu cầu nội dung bản tin tử vi hằng ngày:
1. Đầu tiên, hãy đóng vai trò Dịch sư và tính toán chi tiết Lịch Vạn Niên của ngày ${params.dateStr} (bao gồm: Ngày Âm lịch tương ứng, Can Chi của ngày/tháng/năm, Trực của ngày, ngày Hoàng đạo hay Hắc đạo, Hướng xuất hành tốt và các Tuổi xung khắc).
2. Hãy kết hợp hài hòa thông tin Lịch Vạn Niên trên với Con số chủ đạo, Mệnh ngày tháng sinh, Ngày cá nhân (Số ${params.personalDay}), ${tobInstruction} và vấn đề cải vận "${params.focusArea}" của họ để luận giải vận khí.
3. Bản tin gửi cho người dùng phải có cấu trúc Markdown rõ ràng gồm 3 phần chính (không thêm lời mở đầu hay kết thúc rườm rà):

### 📅 LỊCH VẠN NIÊN & VẬN KHÍ HÔM NAY
- Ngày Âm lịch & Bát tự Can Chi ngày.
- Đánh giá ngày (Hoàng đạo/Hắc đạo) & Trực của ngày.

### 🔮 DỰ BÁO CÁ NHÂN HẰNG NGÀY
- Phân tích sự tương tác giữa Ngày cá nhân, Số chủ đạo và Mệnh ngày tháng với năng lượng của ngày hôm nay đối với khía cạnh cải vận "${params.focusArea}".

### 💡 LỜI KHUYÊN HÀNH ĐỘNG
- Nên làm gì và tránh làm gì hôm nay để mọi việc hanh thông cát lợi.
- Các khung giờ Hoàng đạo tốt trong ngày để khởi sự.
- Hướng xuất hành (Tài thần/Hỷ thần) và các tuổi xung khắc cần đề phòng.

*Lưu ý:*
- Hãy viết ngắn gọn, súc tích, dễ hiểu và mang năng lượng tích cực, truyền cảm hứng.
- Trực tiếp đi vào các mục Markdown như trên.`;

  return callAi(prompt);
}


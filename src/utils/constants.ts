// Gói dịch vụ cải vận
export const PACKAGE_TYPE_200K = '200k';
export const PACKAGE_TYPE_500K = '500k';

export const PRICE_200K = 200000;
export const PRICE_500K = 500000;

// Trạng thái đơn hàng
export const ORDER_PENDING = 'pending';
export const ORDER_PAID = 'paid';
export const ORDER_EXPIRED = 'expired';
export const ORDER_COMPLETED = 'completed';

export const ORDER_STATUSES = [ORDER_PENDING, ORDER_PAID, ORDER_EXPIRED, ORDER_COMPLETED] as const;

// Hỗ trợ trực tuyến & Zalo
export const ZALO_ADMIN_NUMBER = '0362931719';
export const ZALO_LINK = `https://zalo.me/${ZALO_ADMIN_NUMBER}`;

// Trạng thái phòng chat
export const CHAT_ROOM_ACTIVE = 'active';
export const CHAT_ROOM_CLOSED = 'closed';

// Loại người gửi tin nhắn
export const SENDER_USER = 'user';
export const SENDER_ADMIN = 'admin';
export const SENDER_SYSTEM = 'system';

// Định nghĩa Mệnh & Ngũ hành phong thủy
export const MENH_KIM = 'Kim';
export const MENH_MOC = 'Mộc';
export const MENH_THUY = 'Thủy';
export const MENH_HOA = 'Hỏa';
export const MENH_THO = 'Thổ';

export const MENH_LIST = [MENH_KIM, MENH_MOC, MENH_THUY, MENH_HOA, MENH_THO] as const;

// Số ngày subscription horoscope theo gói
export const CREDIT_DAYS_200K = 30  // 1 tháng
export const CREDIT_DAYS_500K = 90  // 3 tháng

// Định nghĩa 5 Vấn đề cải vận
export const FOCUS_GIA_DAO = 'Gia đạo';
export const FOCUS_TINH_DUYEN = 'Tình duyên';
export const FOCUS_SUC_KHOE = 'Sức khỏe';
export const FOCUS_CONG_DANH = 'Công danh';
export const FOCUS_SU_NGHIEP = 'Sự nghiệp';

export const FOCUS_AREAS = [
  FOCUS_GIA_DAO,
  FOCUS_TINH_DUYEN,
  FOCUS_SUC_KHOE,
  FOCUS_CONG_DANH,
  FOCUS_SU_NGHIEP
] as const;

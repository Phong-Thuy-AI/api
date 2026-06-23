# 🚀 Hướng Dẫn Triển Khai Backend (API) Lên VPS

Tài liệu này hướng dẫn chi tiết quy trình cấu hình, chuẩn bị và khởi chạy dự án Backend bằng Docker & Nginx Reverse Proxy trên VPS lần đầu tiên, cũng như cách cập nhật code sau này.

---
tuandt/Tuandoan@240498

acount: admin/Tranlai0711

## 📂 I. Các File Cần Cấu Hình

Trước khi khởi chạy hệ thống, bạn cần sửa cấu hình ở **2 file** dưới đây trong thư mục `api`:

### 1. Tạo file `.env`
Sao chép file `.env.example` để tạo file `.env`:
```bash
cp .env.example .env
```
Mở file `.env` vừa tạo và chỉnh sửa các tham số tương ứng với VPS của bạn:
*   **Security & Admin**:
    *   `JWT_SECRET`: Đặt một chuỗi bí mật dài, ngẫu nhiên để ký và xác thực token JWT.
    *   `ADMIN_USERNAME` & `ADMIN_PASSWORD`: Đặt tên đăng nhập và mật khẩu cho tài khoản Admin.
*   **Database (MySQL)**:
    *   `DB_PASSWORD`: Đặt mật khẩu root bảo mật cho MySQL container. Mật khẩu này được Docker tự động sử dụng khi tạo cơ sở dữ liệu.
    *   `DB_NAME`: Tên database của hệ thống (ví dụ: `phongthuy_simcathung`).
*   **AI Providers**:
    *   `GEMINI_API_KEY`: API Key Gemini của bạn để xử lý phân tích AI.
*   **Thông tin Email SMTP (Nodemailer)**:
    *   `SMTP_USER`: Địa chỉ Gmail của bạn gửi báo cáo phong thủy.
    *   `SMTP_PASS`: Mật khẩu ứng dụng (App Password) của Gmail đó.
    *   `EMAIL_FROM`: Tiêu đề người gửi (ví dụ: `contact@phongthuysimcathung.com`).
*   **Domain & Client URL**:
    *   `CLIENT_URL`: URL chạy Frontend thực tế (ví dụ: `https://phongthuysimcathung.com`). Cần cấu hình chính xác để Nginx/CORS cho phép gửi request.
    *   `NGINX_SERVER_NAME`: Domain trỏ về API Backend (ví dụ: `api.phongthuysimcathung.com`).

---

### 2. Cập nhật [nginx/default.conf](file:///c:/Users/Admin/Desktop/CODE/phongthuy_chu_a_tran/api/nginx/default.conf)
Mở file `nginx/default.conf` và thay đổi tên miền mặc định `api.phongthuysimcathung.com` thành tên miền của bạn tại:
*   **Dòng 5**: Tên miền cấu hình HTTP (cổng 80).
*   **Dòng 22**: Tên miền cấu hình HTTPS (cổng 443).
*   **Dòng 27 & 28**: Đường dẫn chứng chỉ SSL Let's Encrypt được sinh ra:
    ```nginx
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    ```

---

## 🛠️ II. Quy Trình Triển Khai Lần Đầu Tiên (Xin Cấp SSL Certbot)

Do Nginx sẽ bị lỗi không khởi chạy được nếu trỏ HTTPS đến tệp chứng chỉ SSL chưa tồn tại trên VPS, chúng ta cần thực hiện quy trình "mồi" SSL dưới đây:

### Bước 1: Tạm thời vô hiệu hóa block HTTPS (443)
Mở file `nginx/default.conf`, sử dụng dấu `#` để **comment tạm thời** toàn bộ block cấu hình cổng 443 (từ dòng 19 đến dòng 63). Chỉ giữ lại block cổng 80 hoạt động để Certbot thực hiện thử thách xác thực (ACME HTTP-01 challenge).

### Bước 2: Chạy các container dịch vụ cơ bản
Chạy lệnh sau tại thư mục chứa dự án trên VPS để khởi chạy cơ sở dữ liệu, Nginx cổng 80 và Certbot:
```bash
docker compose up -d db web certbot
```

### Bước 3: Gửi yêu cầu cấp chứng chỉ SSL mới
Chạy lệnh dưới đây để Certbot kết nối với Let's Encrypt và tự động cấp chứng chỉ:
```bash
docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email admin@yourdomain.com --agree-tos --no-eff-email -d api.yourdomain.com
```
> [!IMPORTANT]
> Thay thế `admin@yourdomain.com` và `api.yourdomain.com` bằng email quản trị và tên miền thực tế của bạn.

### Bước 4: Kích hoạt lại cấu hình HTTPS
Sau khi Certbot báo cấp chứng chỉ thành công (`Congratulations! ...`):
1. Mở lại file `nginx/default.conf` và **bỏ dấu comment `#`** ở block cổng 443 đã ẩn ở Bước 1.
2. Kiểm tra lại đường dẫn SSL đã khớp hoàn toàn với tên miền mới cấu hình ở dòng 27 và 28 chưa.

### Bước 5: Build và khởi chạy toàn bộ hệ thống
Khởi chạy dự án đầy đủ các container, tiến hành build image từ Dockerfile backend:
```bash
docker compose up -d --build
```

### Bước 6: Khởi tạo bảng và nạp dữ liệu 80 Quẻ dịch (Chỉ chạy 1 lần)
Mặc định, server không tự động chạy đồng bộ schema khi restart để tránh mất dữ liệu của người dùng. Do đó, trên database mới của VPS, bạn cần chạy lệnh import để tự động tạo toàn bộ bảng và import nội dung 80 quẻ dịch:
```bash
docker compose exec api node dist/utils/importHexagrams.js
```

---

## 🔄 III. Quy Trình Cập Nhật Code Sau Này

Khi bạn phát triển các tính năng mới và đẩy code lên git repo `api`, việc triển khai bản cập nhật mới trên VPS cực kỳ đơn giản:

1.  **Pull code mới nhất từ Git**:
    ```bash
    git pull
    ```
2.  **Rebuild và cập nhật Container**:
    ```bash
    docker compose up -d --build
    ```
    *   Hệ thống sẽ build lại Docker image từ source code mới và restart container API mà không làm gián đoạn MySQL hay chứng chỉ SSL.
    *   **Tự động Migration**: Khi container API được khởi động, lệnh `npm start` sẽ tự động thực thi các script migration cấu trúc bảng (như `migrateEmailOptional.js` và `migrateFocusArea.js`), đảm bảo cấu trúc database luôn đồng bộ với mã nguồn mới nhất mà không làm mất dữ liệu cũ.

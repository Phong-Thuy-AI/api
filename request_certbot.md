🚀 Hướng dẫn lấy chứng chỉ SSL Let's Encrypt lần đầu trên VPS
Khi triển khai lên server thật có IP Public và đã trỏ tên miền (ví dụ: api.phongthuysimcathung.com), Nginx sẽ bị lỗi không khởi động được nếu cấu hình HTTPS (ssl_certificate tại api/nginx/default.conf) chỉ đến tệp chứng chỉ chưa tồn tại.

Bạn hãy thực hiện các bước sau để xin chứng chỉ lần đầu:

Tạm thời tắt cấu hình HTTPS trên Nginx: Mở file 

default.conf
, comment tạm thời block cấu hình HTTPS (từ dòng 19 đến dòng 63) lại. Chỉ để lại block HTTP cổng 80 để Certbot xác thực qua HTTP-01 challenge.

Khởi chạy Nginx và Certbot: Chạy lệnh để build và start hai container này:

bash
docker-compose up -d web certbot
Chạy lệnh yêu cầu cấp chứng chỉ: Thực hiện chạy lệnh yêu cầu Certbot sinh chứng chỉ SSL mới thông qua Webroot:

bash
docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email admin@phongthuysimcathung.com --agree-tos --no-eff-email -d api.phongthuysimcathung.com
(Thay thế admin@phongthuysimcathung.com và api.phongthuysimcathung.com bằng thông tin thực tế).

Kích hoạt cấu hình HTTPS: Sau khi Certbot báo cấp chứng chỉ thành công, mở lại file 

default.conf
, bỏ các ký tự comment ở block cổng 443.

Tải lại cấu hình Nginx: Chạy lệnh sau để Nginx reload và áp dụng SSL mới mà không làm gián đoạn hệ thống:

bash
docker-compose exec web nginx -s reload
Từ thời điểm này, container certbot sẽ chạy ngầm và tự động cập nhật chứng chỉ mới trước khi hết hạn. Chúng ta đã hoàn thành Phase 1. Bạn có muốn tôi tiến hành thực hiện Phase 2: Viết mã nguồn Thuật toán Phong thủy & Unit Tests luôn không?
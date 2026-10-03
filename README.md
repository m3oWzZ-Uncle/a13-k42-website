# A13-K42 Ngô Quyền

Website lưu giữ kỷ niệm của lớp. Bản hiện tại là giao diện HTML/CSS tĩnh.

## Chạy build

Cần Node.js 18 trở lên. Project không có thư viện cần cài.

```sh
npm run build
```

Lệnh build kiểm tra tài liệu HTML, các liên kết nội bộ và tài nguyên cục bộ,
sau đó sao chép nội dung `src/` sang `dist/`. Có thể mở `dist/index.html`
để xem giao diện hoặc dùng `dist/` làm thư mục xuất bản trên dịch vụ hosting.
Chỉnh sửa giao diện trong `src/`, rồi chạy build để cập nhật `dist/`.

## Trạng thái chức năng

Đăng nhập Google, phân quyền admin, đăng ảnh và lượt tim chưa được triển khai.
Ảnh và câu chuyện của lớp hiện dùng các khung chờ nội dung.

## Git

`.gitignore` loại trừ `node_modules/`, `.next/`, `.env`, `.env.local`
và các file cấu hình môi trường khác. Không lưu mật khẩu, token hoặc khóa bí mật
trong mã nguồn. `dist/` được theo dõi vì cấu hình Sites hiện tại dùng file tĩnh.

Repository được chuẩn bị tại máy, chưa cấu hình remote GitHub và chưa push.

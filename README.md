# A13-K42 Ngô Quyền

Website lưu giữ kỷ niệm của lớp, dùng HTML/CSS/JavaScript và Supabase cho Google Auth,
dữ liệu và ảnh riêng của lớp. Hosting Vercel phục vụ thư mục `dist/`.

## Chạy build

Cần Node.js 22 trở lên.

```sh
npm ci
npm test
npm run build
```

Lệnh build kiểm tra tài liệu HTML, các liên kết nội bộ và tài nguyên cục bộ,
sau đó sao chép nội dung `src/` sang `dist/` và bundle JavaScript cùng Supabase SDK.
Phần đăng nhập cần phục vụ website qua HTTP(S), không mở bằng `file://`.
Chỉnh sửa giao diện trong `src/`, rồi chạy build để cập nhật `dist/`.

## Trạng thái chức năng

Đã viết đăng nhập Google; tài khoản mới mặc định viewer (chỉ đọc), admin quản lý
ảnh/kỷ niệm/dấu mốc/lưu bút và cấp/thu hồi quyền admin. Quyền được kiểm tra bằng
PostgreSQL RLS và RPC, không tin role do trình duyệt hoặc user metadata cung cấp.
Không có tính năng thả tim theo yêu cầu mới nhất. Đọc `SETUP-GOOGLE.md` để kết nối
Supabase, Google OAuth và cấp admin đầu tiên. Chưa xác minh đăng nhập thật cho đến
khi chủ website hoàn tất cấu hình dịch vụ.

## Git

`.gitignore` loại trừ `node_modules/`, `.next/`, `.env`, `.env.local`
và các file cấu hình môi trường khác. Không lưu mật khẩu, token hoặc khóa bí mật
trong mã nguồn. `dist/` được theo dõi vì cấu hình Sites hiện tại dùng file tĩnh.

Remote GitHub: https://github.com/m3oWzZ-Uncle/a13-k42-website
Push bằng GitHub Desktop nếu Git CLI trên máy chưa có phiên đăng nhập.

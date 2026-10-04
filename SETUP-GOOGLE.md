# Kết nối đăng nhập Google

Code đã có đăng nhập Google và phân quyền, nhưng cần thực hiện các bước dưới đây
trên tài khoản Supabase/Google của chủ website trước khi dùng thật.

## 1. Tạo Supabase

1. Mở https://supabase.com/dashboard và đăng nhập.
2. Chọn **New project**, tạo project `a13-k42`. Chọn Free nếu được cung cấp.
3. Đặt mật khẩu database mạnh và lưu riêng. Không gửi mật khẩu vào chat hoặc Git.
4. Mở **SQL Editor**, tạo query, dán toàn bộ `supabase/schema.sql` và Run.
   Đây là migration cho project mới, chạy một lần; không chạy lại trên database có bảng này.
5. Trong **Project Settings / API** hoặc **Connect**, lấy Project URL và
   **Publishable key** bắt đầu bằng `sb_publishable_`.

## 2. Bật Google

1. Mở https://console.cloud.google.com và tạo/chọn project Google Cloud.
2. Trong **Google Auth Platform**, cấu hình Branding, Audience và Data Access.
   Chỉ cần scopes `openid`, `userinfo.email`, `userinfo.profile`.
3. Trong **Clients**, tạo OAuth client loại **Web application**.
4. Authorized JavaScript origins: địa chỉ website Vercel thật của bạn,
   ví dụ `https://TEN-PROJECT.vercel.app` (thay bằng link thật).
5. Authorized redirect URIs: sao chép Callback URL từ mục Google provider
   trên Supabase, thường dạng `https://PROJECT-REF.supabase.co/auth/v1/callback`.
6. Trong Supabase **Authentication / Sign In / Providers / Google**,
   bật Google và điền Client ID, Client Secret vừa tạo.
   Client Secret chỉ lưu trong Supabase, KHÔNG đưa vào Vercel hoặc mã nguồn.
7. Nếu Google app đang ở Testing, thêm Gmail admin và những thành viên cần thử
   vào Test users. Để cả lớp đăng nhập, chuyển audience sang Production khi sẵn sàng.
8. Tắt các provider khác và anonymous sign-ins nếu chỉ muốn dùng Google.

## 3. URL và cấu hình Vercel

1. Supabase **Authentication / URL Configuration**:
   - Site URL: `https://TEN-PROJECT.vercel.app`.
   - Redirect URLs: `https://TEN-PROJECT.vercel.app/`.
   Dùng domain production ổn định, không dùng link deploy thay đổi mỗi lần.
2. Vercel **Project / Settings / Environment Variables**:
   - `SUPABASE_URL`: Project URL của Supabase.
   - `SUPABASE_PUBLISHABLE_KEY`: publishable key `sb_publishable_...`.
   Hai giá trị này là cấu hình công khai; các quyền truy cập được bảo vệ bằng RLS.
   Không dùng `sb_secret_...`, service-role key, database password hoặc Google secret.
3. Build command: `npm run build`; Output: `dist`; Preset: Other.
4. Push bản code mới bằng GitHub Desktop. Vercel tự build lại; nếu chỉ thay
   environment variables, chọn Redeploy để áp dụng.

## 4. Cấp quyền admin đầu tiên

1. Đăng nhập website bằng Google `phungquangthai123ok@gmail.com` một lần.
   Tài khoản vừa tạo lúc này vẫn chỉ được xem.
2. Chủ Supabase chạy toàn bộ `supabase/first-admin.sql` trong SQL Editor.
   Query chỉ cấp quyền cho đúng Gmail đã xác thực qua Google.
3. Tải lại website. Thanh quản trị sẽ xuất hiện.
4. Admin có thể đăng/sửa/xóa ảnh, kỷ niệm, dấu mốc và lưu bút;
   mở **Quản lý quyền** để cấp/thu hồi admin cho tài khoản đã đăng nhập ít nhất một lần.

Mặc định thành viên chỉ đọc; chưa có quyền thả tim theo yêu cầu mới nhất.
Không tự cấp admin cho người đăng nhập đầu tiên. Không cho phép tài khoản tự sửa role.
Không thể thu hồi admin cuối cùng từ website.
Ảnh là private; thành viên nhận link xem ảnh có thời hạn một giờ.
Link đã phát hành có thể còn dùng đến khi hết hạn sau khi đăng xuất.
Trang giới thiệu của lớp vẫn công khai, nội dung thật và ảnh chỉ tải sau đăng nhập.

## Kiểm tra sau khi kết nối

- Chưa đăng nhập: không đọc được bài hoặc ảnh riêng.
- Gmail thông thường: chỉ xem, không có nút quản trị.
- Gmail admin: tạo/sửa/xóa một bài thử và cấp quyền cho tài khoản thử.
- Thu hồi quyền tài khoản thử, xác nhận không ghi được nữa.
- Đăng xuất/đăng nhập lại và kiểm tra trên điện thoại.

Tài liệu gốc: https://supabase.com/docs/guides/auth/social-login/auth-google
và https://supabase.com/docs/guides/database/postgres/row-level-security

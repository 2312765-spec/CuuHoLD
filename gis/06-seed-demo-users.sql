-- gis/06-seed-demo-users.sql
-- Tạo 3 tài khoản demo ở CLAUDE.md Mục 12 (victim/rescuer/commander, password demo1234).
--
-- TẠI SAO CẦN FILE NÀY (xem CLAUDE.md Mục 15 — audit 2026-09-06):
-- Trước đây 3 tài khoản này được tạo bằng cách gọi POST /api/auth/register với role
-- rescuer/commander tự khai trong body — vì RegisterDto cho phép client tự chọn role tự do.
-- Đó chính là lỗ hổng leo thang đặc quyền: BẤT KỲ ai gọi thẳng API (không qua UI) cũng tự
-- phong mình làm commander/rescuer được, xem được toàn bộ PII nạn nhân (tên, SĐT, GPS) và
-- (với commander) tự phân công đội cho SOS thật. Đã vá bằng cách ép role='victim' bất kể
-- client gửi gì ở endpoint public (xem auth/dto/register.dto.ts, users/users.service.ts).
--
-- Hệ quả: route public KHÔNG CÒN cách nào tạo tài khoản rescuer/commander nữa — đúng ý đồ
-- bảo mật, nhưng cũng có nghĩa gis/04-create-rescue-teams.sql (cần sẵn user rescuer demo
-- 0900000002 để gắn leader_id) sẽ không còn user nào để join nếu chạy trên DB mới hoàn toàn.
-- File này thay thế đúng bước "tạo user rescuer/commander" mà trước đây làm qua register API.
--
-- Chạy TRƯỚC gis/04-create-rescue-teams.sql (04 cần sẵn user phone=0900000002).
-- Hash bcrypt cost=12 cho "demo1234", tạo bằng chính bcrypt version dự án dùng
-- (backend/package.json) — xác nhận compareSync('demo1234', hash) === true trước khi ghi vào đây.

INSERT INTO public.users (phone, name, password_hash, role, ward_code)
VALUES
  ('0900000001', 'Nạn nhân Demo', '$2b$12$oegCU6rX75yWjXzbMvfjgOI39zgWal/dPge.Pi56jeYXmMf0/6Q5q', 'victim', '24781'),
  ('0900000002', 'Cứu hộ Demo', '$2b$12$nIRhAFQmHqKzpkvJCnIQ7uKVP/BXvrqOkSHAdkPr8flntnAW2agTy', 'rescuer', '24781'),
  ('0900000003', 'Điều phối Demo', '$2b$12$6Vq3voeezv3/6.6VbVCcnO65dWwakIVRkBVr7YKCUjElEnARDmxMi', 'commander', NULL)
ON CONFLICT (phone) DO NOTHING;

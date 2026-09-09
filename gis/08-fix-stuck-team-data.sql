-- gis/08-fix-stuck-team-data.sql
-- Sửa dữ liệu test sai khiến rescuer không bao giờ thấy nhiệm vụ nào (2026-09-07).
--
-- Nguyên nhân (điều tra bằng cách query trực tiếp DB — xem lịch sử debug):
-- 1. "Đội cứu hộ Xuân Hương 1" kẹt status='busy' dù KHÔNG có sos_requests nào còn
--    tham chiếu assigned_team_id tới đội này — do bug ở SosService.cancel() (đã vá
--    trong backend/src/sos/sos.service.ts): huỷ SOS đã được phân công đội trước đó
--    không hề giải phóng đội về lại 'available', khác với updateStatus() khi SOS
--    chuyển 'resolved' (có giải phóng). Đội bị kẹt busy vĩnh viễn.
-- 2. "Đội cứu hộ Xuân Hương 2" là đội 'available' DUY NHẤT, nhưng current_location
--    seed sai — cách vị trí SOS thật ~112km (kinh độ 107.41 thay vì ~108.44), ngoài
--    hẳn bán kính auto-assign 10km (AUTO_ASSIGN_RADIUS_M trong sos.service.ts).
-- => Kết hợp cả 2: không đội nào vừa 'available' vừa trong bán kính cho MỌI SOS ở
--    ward 24781 → auto-assign luôn thất bại âm thầm, SOS mãi 'pending', rescuer nào
--    đăng nhập cũng thấy danh sách trống bất kể có đúng là leader hay không.

-- Giải phóng đội 1 (đã xác nhận không có SOS active nào đang gán cho đội này).
UPDATE public.rescue_teams
SET status = 'available', updated_at = NOW()
WHERE id = '63017a5a-4d60-4450-bcfc-7be28c95e479';

-- Đưa đội 2 về đúng khu vực ward 24781 (Xuân Hương - Đà Lạt), gần vị trí SOS thật
-- thay vì toạ độ sai cách 112km. Chỉnh lại nếu vị trí thật của đội này khác.
UPDATE public.rescue_teams
SET current_location = ST_SetSRID(ST_MakePoint(108.45, 11.95), 4326), updated_at = NOW()
WHERE id = 'ad959023-e310-408b-9531-e2ddc791b27d';

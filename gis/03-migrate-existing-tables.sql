-- gis/03-migrate-existing-tables.sql
-- Chuyển users/sos_requests từ district_code (huyện, đã lỗi thời) sang ward_code (xã/phường).
-- Chạy SAU khi 01-schema-wards.sql và 02-seed-wards.sql đã chạy xong (wards phải có dữ liệu
-- trước khi thêm FOREIGN KEY, nếu không ALTER TABLE sẽ báo lỗi vi phạm ràng buộc).

-- users: xóa dữ liệu ward_code cũ không còn khớp mã xã mới (vd "672" — mã huyện cũ),
-- tránh FK constraint bên dưới fail vì giá trị mồ côi.
UPDATE public.users
SET ward_code = NULL
WHERE ward_code IS NOT NULL
  AND ward_code NOT IN (SELECT ward_code FROM public.wards);

ALTER TABLE public.users DROP COLUMN IF EXISTS district_code;

ALTER TABLE public.users
  ADD CONSTRAINT fk_users_ward FOREIGN KEY (ward_code) REFERENCES public.wards(ward_code);

-- sos_requests: đổi tên cột (thay vì thêm cột mới) vì cột district_code hiện chưa được
-- dùng bởi UI/dữ liệu thật nào — an toàn để rename.
ALTER TABLE public.sos_requests RENAME COLUMN district_code TO ward_code;

UPDATE public.sos_requests
SET ward_code = NULL
WHERE ward_code IS NOT NULL
  AND ward_code NOT IN (SELECT ward_code FROM public.wards);

ALTER TABLE public.sos_requests
  ADD CONSTRAINT fk_sos_ward FOREIGN KEY (ward_code) REFERENCES public.wards(ward_code);

-- Tự động suy ra ward_code từ tọa độ GPS thay vì tin dữ liệu client gửi lên
-- (client có thể gửi sai/giả mạo ward_code, nhưng location + PostGIS thì không).
CREATE OR REPLACE FUNCTION public.set_ward_code_from_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    SELECT ward_code INTO NEW.ward_code
    FROM public.wards
    WHERE ST_Contains(boundary, NEW.location)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sos_set_ward ON public.sos_requests;

CREATE TRIGGER trg_sos_set_ward
BEFORE INSERT OR UPDATE OF location ON public.sos_requests
FOR EACH ROW EXECUTE FUNCTION public.set_ward_code_from_location();

-- Lưu ý: bảng rescue_teams chưa tồn tại (module chưa được xây). Khi tạo, dùng thẳng
-- ward_code VARCHAR(10) REFERENCES public.wards(ward_code) — không tạo lại district_code.

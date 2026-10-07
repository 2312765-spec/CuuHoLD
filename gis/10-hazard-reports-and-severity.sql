-- gis/10-hazard-reports-and-severity.sql
-- Báo cáo từ cộng đồng (crowdsourcing) cho cảnh báo sạt lở/chặn đường + mức độ đỏ/vàng.
-- Chạy SAU 09-create-road-hazards.sql. Toàn bộ là phép THÊM (IF NOT EXISTS) — không đổi/xoá dữ liệu cũ.

-- 1) Mức độ cảnh báo: 'blocked' (ĐỎ) = chặn đường, thuật toán tìm đường né vùng này;
--    'caution' (VÀNG) = cẩn trọng, chỉ hiển thị trên bản đồ, KHÔNG làm tuyến đường đi vòng.
--    Bản ghi cũ mặc định 'blocked' (đúng hành vi hiện tại của chúng).
ALTER TABLE public.road_hazards
  ADD COLUMN IF NOT EXISTS severity VARCHAR(10) NOT NULL DEFAULT 'blocked'
  CHECK (severity IN ('blocked', 'caution'));

-- 2) Báo cáo từ người dân/tình nguyện viên — nằm ở trạng thái 'pending' (chờ duyệt) cho tới khi
--    commander xác minh. CHỈ khi 'approved' mới sinh ra 1 dòng road_hazards (hazard_id) để hiện
--    lên bản đồ chung.
CREATE TABLE IF NOT EXISTS public.hazard_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id        UUID NOT NULL REFERENCES public.users(id),
  type               VARCHAR(20) NOT NULL
                      CHECK (type IN ('landslide','fallen_tree','flood','danger','other')),
  description        TEXT,
  location           GEOMETRY(Point, 4326) NOT NULL,
  -- Sai số GPS (mét) trình duyệt báo tại thời điểm báo cáo — để người duyệt biết vị trí đáng tin tới đâu.
  accuracy_m         INTEGER,
  location_estimated BOOLEAN NOT NULL DEFAULT false,
  -- Ảnh hiện trường lưu thẳng trong DB (đã nén ở trình duyệt, tối đa ~2MB, chỉ jpeg/png/webp):
  -- không cần dịch vụ lưu trữ riêng, và không bị mất khi server deploy lại như lưu ra đĩa.
  -- Không bao giờ SELECT cột này trong truy vấn danh sách — chỉ đọc qua GET /:id/image.
  image_data         BYTEA,
  image_mime         VARCHAR(20),
  status             VARCHAR(10) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  reviewed_by        UUID REFERENCES public.users(id),
  reviewed_at        TIMESTAMPTZ,
  review_note        TEXT,
  hazard_id          UUID REFERENCES public.road_hazards(id),
  ward_code          VARCHAR(10) REFERENCES public.wards(ward_code),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hazard_reports_location_gist_idx ON public.hazard_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS hazard_reports_status_created_idx ON public.hazard_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS hazard_reports_reporter_idx ON public.hazard_reports (reporter_id);

DROP TRIGGER IF EXISTS trg_hazard_reports_set_ward ON public.hazard_reports;
CREATE TRIGGER trg_hazard_reports_set_ward
BEFORE INSERT OR UPDATE OF location ON public.hazard_reports
FOR EACH ROW EXECUTE FUNCTION public.set_ward_code_from_location();

-- RLS bật, không policy (cùng cách làm với rescue_teams/road_hazards): backend nối DB trực tiếp
-- nên không bị cản; chỉ đóng cửa sổ lộ ảnh/dữ liệu người báo qua REST tự sinh của Supabase.
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

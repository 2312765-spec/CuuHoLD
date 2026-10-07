-- gis/09-create-road-hazards.sql
-- Bảng cảnh báo/chặn đường (sạt lở, cây đổ, ngập lụt, nguy hiểm khác) do commander tạo — tính
-- năng "quản lý cảnh báo/chặn đường" thứ 3/4 trong danh sách admin (CLAUDE.md Mục 11, chưa có
-- mục audit riêng lúc viết file này — xem log tính năng ở CLAUDE.md khi commit).
-- Chạy SAU 01-03 (cần bảng wards đã có dữ liệu để trigger set_ward_code_from_location hoạt động).

CREATE TABLE IF NOT EXISTS public.road_hazards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(20) NOT NULL
                 CHECK (type IN ('landslide','fallen_tree','flood','danger','other')),
  description   TEXT,
  location      GEOMETRY(Point, 4326) NOT NULL,
  -- Vùng ảnh hưởng là 1 hình tròn quanh location — đơn giản cho commander đánh dấu nhanh trên
  -- bản đồ (chọn điểm + kéo bán kính), không cần vẽ polygon tay. Trần 5000m là giới hạn Ở TẦNG
  -- ỨNG DỤNG để tránh commander lỡ tay tạo vùng chặn khổng lồ — KHÔNG phải giới hạn kỹ thuật đã
  -- xác nhận của OpenRouteService avoid_polygons (chưa verify được, xem routing.service.ts).
  radius_meters INTEGER NOT NULL DEFAULT 200 CHECK (radius_meters > 0 AND radius_meters <= 5000),
  ward_code     VARCHAR(10) REFERENCES public.wards(ward_code),
  created_by    UUID NOT NULL REFERENCES public.users(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS road_hazards_location_gist_idx ON public.road_hazards USING GIST (location);
CREATE INDEX IF NOT EXISTS road_hazards_active_idx ON public.road_hazards (is_active);

-- Dùng lại ĐÚNG function đã tạo ở 03-migrate-existing-tables.sql cho sos_requests — cùng nhu
-- cầu "suy ra ward_code từ toạ độ GPS", không viết lại trigger function riêng.
DROP TRIGGER IF EXISTS trg_road_hazards_set_ward ON public.road_hazards;
CREATE TRIGGER trg_road_hazards_set_ward
BEFORE INSERT OR UPDATE OF location ON public.road_hazards
FOR EACH ROW EXECUTE FUNCTION public.set_ward_code_from_location();

-- RLS: bật nhưng không thêm policy (cùng cách làm với rescue_teams ở 04) — backend nối DB trực
-- tiếp qua DATABASE_URL (không qua PostgREST/anon key) nên không bị RLS cản; chỉ đóng cửa sổ lộ
-- dữ liệu qua REST API tự sinh của Supabase.
ALTER TABLE public.road_hazards ENABLE ROW LEVEL SECURITY;

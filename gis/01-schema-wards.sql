-- gis/01-schema-wards.sql
-- Bảng tham chiếu ranh giới xã/phường Lâm Đồng mới (sau sáp nhập 2025).
-- Thay thế mô hình "district_code" (huyện) cũ — hành chính hiện tại chỉ còn
-- 2 cấp: tỉnh → xã/phường. Chạy trước 02-seed-wards.sql.

CREATE TABLE IF NOT EXISTS public.wards (
  ward_code   VARCHAR(10) PRIMARY KEY,   -- ma_xa
  ward_name   VARCHAR(100) NOT NULL,     -- ten_xa
  ward_type   VARCHAR(20) NOT NULL,      -- 'Phường' | 'Xã' | 'Đặc khu'
  merged_from TEXT,                      -- các đơn vị cũ đã sáp nhập vào (sap_nhap)
  area_km2    NUMERIC(10,2),
  population  INTEGER,
  boundary    GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS wards_boundary_gist_idx ON public.wards USING GIST (boundary);

-- Dữ liệu tham chiếu công khai, không nhạy cảm — bật RLS + policy đọc công khai
-- (giống cách xử lý public.spatial_ref_sys) để không bị Supabase Security Advisor cảnh báo.
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to wards"
ON public.wards
FOR SELECT
USING (true);

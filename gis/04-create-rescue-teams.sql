-- gis/04-create-rescue-teams.sql
-- Tạo bảng rescue_teams (chưa từng tồn tại trong DB — GisService.findNearestTeams()
-- đã join bảng này từ trước nhưng luôn lỗi runtime vì bảng chưa được tạo).
-- Chạy SAU 01-03 (FK vào users và wards).

CREATE TABLE IF NOT EXISTS public.rescue_teams (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL,
  leader_id         UUID NOT NULL REFERENCES public.users(id),
  ward_code         VARCHAR(10) NOT NULL REFERENCES public.wards(ward_code),
  specialties       TEXT[] DEFAULT '{}',
  current_location  GEOMETRY(Point, 4326),
  status            VARCHAR(20) NOT NULL DEFAULT 'offline'
                     CHECK (status IN ('available','busy','offline')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rescue_teams_location_gist_idx ON public.rescue_teams USING GIST (current_location);
CREATE INDEX IF NOT EXISTS rescue_teams_ward_code_idx ON public.rescue_teams (ward_code);

-- RLS: bật nhưng KHÔNG thêm policy nào (mặc định deny), khác với wards (public-read).
-- Lý do: rescue_teams chứa GPS sống của nhân sự cứu hộ + liên kết danh tính qua leader_id,
-- không phải dữ liệu tham chiếu công khai. Backend kết nối DB trực tiếp qua DATABASE_URL
-- (không qua PostgREST/anon key) nên RLS không cản backend — chỉ đóng cửa sổ lộ dữ liệu
-- qua REST API tự sinh của Supabase.
ALTER TABLE public.rescue_teams ENABLE ROW LEVEL SECURITY;

-- Seed 1 đội demo gắn với tài khoản rescuer demo (0900000002, ward 24781 — Xuân Hương - Đà Lạt)
INSERT INTO public.rescue_teams (name, leader_id, ward_code, specialties, status, current_location)
SELECT 'Đội cứu hộ Xuân Hương 1', u.id, '24781',
       ARRAY['flood','medical','accident'], 'available',
       ST_SetSRID(ST_MakePoint(108.4419, 11.9465), 4326)
FROM public.users u
WHERE u.phone = '0900000002'
  AND NOT EXISTS (SELECT 1 FROM public.rescue_teams rt WHERE rt.leader_id = u.id);

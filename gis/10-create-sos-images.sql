-- gis/10-create-sos-images.sql
-- F-SOS-06 ảnh hiện trường (CLAUDE.md Mục 15.14). Trước đây frontend nhét cả ảnh dạng
-- data-URI base64 (~80–200 KB) vào sos_requests.image_url — vi phạm SRS Chương 5
-- (image_url VARCHAR(500)) và api-contract (imageUrl là đường dẫn), đồng thời vượt giới hạn
-- body JSON 100 KB mặc định của Express → POST /api/sos bị từ chối, MẤT CẢ TÍN HIỆU SOS.
--
-- Giờ ảnh nằm ở bảng riêng này; sos_requests.image_url chỉ chứa đường dẫn ngắn
-- '/api/sos/{id}/image' (đúng SRS). Ảnh chỉ đọc được qua backend, kiểm quyền giống hệt
-- GET /api/sos/:id — ảnh nạn nhân là dữ liệu cá nhân, không để ở bucket công khai.
-- Mỗi SOS tối đa 1 ảnh (gửi lại thì thay ảnh cũ). Chạy SAU 01-09.

CREATE TABLE IF NOT EXISTS public.sos_images (
  sos_id     UUID PRIMARY KEY REFERENCES public.sos_requests(id) ON DELETE CASCADE,
  mime_type  VARCHAR(20) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data       BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cùng quy ước với wards/rescue_teams: bật RLS, KHÔNG tạo policy nào → Supabase REST
-- (anon key) không đọc được ảnh; chỉ backend (kết nối bằng DATABASE_URL, bỏ qua RLS) đọc.
ALTER TABLE public.sos_images ENABLE ROW LEVEL SECURITY;

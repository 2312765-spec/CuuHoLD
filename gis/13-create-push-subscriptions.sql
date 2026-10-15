-- gis/13-create-push-subscriptions.sql
-- F-PWA-05 thông báo đẩy (CLAUDE.md Mục 15.22). Mỗi dòng = 1 thiết bị/trình duyệt đã bật thông
-- báo (PushSubscription của trình duyệt). Một người có thể có nhiều thiết bị.
-- endpoint UNIQUE: đăng ký lại cùng máy → backend upsert và GÁN LẠI user_id (đổi tài khoản trên
-- cùng máy thì người trước không còn nhận tin). Dịch vụ push trả 404/410 → backend tự xoá dòng.
-- Xoá user → xoá luôn đăng ký (ON DELETE CASCADE). Chạy SAU 01-12.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     VARCHAR(200) NOT NULL,
  auth       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gửi thông báo tìm theo user_id (WHERE user_id = ANY(...)).
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

-- Cùng quy ước với sos_images: bật RLS, KHÔNG policy → Supabase REST (anon key) không đọc được
-- (endpoint + khoá là định danh thiết bị của người dùng); chỉ backend (DATABASE_URL) truy cập.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

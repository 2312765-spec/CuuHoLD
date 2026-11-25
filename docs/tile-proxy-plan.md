# Proxy tile OSM qua backend (áp dụng kỹ thuật của nuoclen.com)

> **Trạng thái (2026-11-25): ĐÃ CODE, cờ mặc định TẮT** (`VITE_DUNG_PROXY_TILE=false`).
> Production vẫn chạy như trước — trình duyệt gọi thẳng `openstreetmap.fr`. Bật theo **Mục 5**.
> Bản đề xuất gốc ở Mục 1–2; thiết kế thật **khác đề xuất ở 3 điểm**, ghi ở Mục 3.

## 1. Bối cảnh

Bản đồ `nuoclen.com` (Leaflet + OSM như mình) mượt hơn không phải vì thư viện khác: **tile đi qua
chính server của họ** (`/tiles/hot/{z}/{x}/{y}.png`, `Cache-Control: public, max-age=86400`) thay vì
trình duyệt gọi thẳng OSM. Đây là việc #4 ở CLAUDE.md Mục 15.7. Lợi ích:

- Trình duyệt không tự phân giải DNS máy chủ OSM nữa (Viettel từng chặn `openstreetmap.org` — Mục 15.12).
- HTTP cache 1 ngày ở trình duyệt giảm số lần chờ mạng khi zoom/pan lại vùng đã xem.

**Không đổi:** upstream vẫn `openstreetmap.fr/hot`; bộ tile offline z8–10 (`public/tiles/`) vẫn ưu
tiên trước, không bao giờ đi qua proxy.

## 2. Rủi ro (đề xuất gốc)

1. **Backend thành điểm lỗi chung cho bản đồ z11+.** Render sập/ngủ → bản đồ trắng. → Giảm bằng cầu
   dao phía client (Mục 3.3).
2. **Render free ngủ sau ~15 phút**, request đầu chờ 30–50 s. UptimeRobot ping 5 phút/lần giảm việc này
   (docs/HOSTING.md Mục 0 bước 4).
3. **Route tile phải public** (thẻ `<img>` không gửi được Bearer token) → cần rate limit riêng và chặn
   lạm dụng làm proxy tải bản đồ, tránh để IP Render bị OSM France chặn (khi đó MỌI người dùng mất nền).

## 3. Thiết kế thật — khác đề xuất ở 3 điểm

### 3.1 Trình duyệt gọi THẲNG Render, không qua Vercel rewrite
Đề xuất gốc dùng rewrite `vercel.json` để tile "same-origin". Bỏ vì:
- Qua rewrite, IP mà Render thấy có thể là IP **của Vercel** → rate limit theo IP (cần
  `TRUST_PROXY_HOPS`, CLAUDE.md Mục 15.28) dồn cả tỉnh vào 1 bucket.
- Phải ghi cứng domain Render vào `vercel.json`.

URL tile proxy = `${VITE_API_BASE_URL}/tiles/{z}/{x}/{y}.png`. Cái giá: khác origin với trang →
backend trả `Cross-Origin-Resource-Policy: cross-origin` (helmet mặc định `same-origin` sẽ làm trình
duyệt chặn ảnh) và CORS theo `FRONTEND_URL` như mọi route khác. Lợi ích DNS + cache vẫn giữ.

### 3.2 Chỉ phục vụ tile trong tỉnh
`backend/src/tiles/tile-bounds.ts`: ô phủ Lâm Đồng + nới 2 ô, z ≤ 18. Ngoài vùng → `400`, không gọi
upstream. Frontend (`tileTrongVungProxy` trong `tileProvider.ts`) dùng cùng phép kiểm — ô ngoài tỉnh
gọi thẳng upstream. Hai bên có test khoá trùng khít (`tileProvider.spec.ts` import thẳng file backend).

### 3.3 Cầu dao chỉ đếm lỗi "thật" của proxy
Đề xuất gốc: 4 lỗi tile/20 s → chuyển nguồn. Sai với dự án này: `<img>` không đọc được mã HTTP, và
upstream trả **404 hợp lệ** ở vùng thưa dữ liệu (rừng từ z16, đo 2026-09-18) — đếm mọi lỗi thì zoom sâu
vùng rừng sẽ ngắt oan. Thiết kế thật (`utils/tileLayer.ts`):
- Tile proxy lỗi → **thử lại đúng tile đó từ upstream** (chưa lùi tile cha).
- Chỉ đếm khi **upstream tải được mà proxy thì không** — bằng chứng backend hỏng.
- 4 lần trong 20 s → ngắt tới hết phiên (tải lại trang mới thử proxy lại), toast 1 lần.
- Proxy lỗi và upstream cũng lỗi → lùi tile cha như cũ, không đếm.
- Cái giá: vùng thưa dữ liệu tốn thêm 1 request upstream cho mỗi ô lần đầu gặp 404.

## 4. Đã làm

**Backend** `backend/src/tiles/`: `GET /api/tiles/:z/:x/:y.png` (public, 600/phút/IP, timeout upstream
8 s). `200` ảnh + `Cache-Control: public, max-age=86400`; `400` sai tham số/ngoài tỉnh; `404` upstream
không có tile; `502` upstream lỗi/không phải ảnh. Không cache RAM. Biến tuỳ chọn
`TILE_PROXY_USER_AGENT` (chính sách OSM yêu cầu User-Agent nhận diện được). Chi tiết:
`docs/api-contract.md`.

**Frontend:** cờ `VITE_DUNG_PROXY_TILE` (`constants/tinhNangBackend.ts`), `tileTrongVungProxy` +
`PROXY_TILE_PATTERN` (`constants/tileProvider.ts`), cầu dao (`utils/tileLayer.ts`), cache SW riêng
`proxy-tiles` (`vite.config.ts`, NetworkFirst 3 s, 200 mục, 30 ngày).

**Kiểm chứng:** BE 12 unit (`tiles.service.spec.ts`, `tile-bounds.spec.ts`) + 7 e2e HTTP thật có
`helmet()` (`test/tiles.e2e-spec.ts`); FE 8 test cầu dao/chọn nguồn + 2 test khớp backend. Chạy backend
thật ở máy: tile Đà Lạt z13 → `200 image/png` (đã mở ảnh xem — đúng bản đồ), header cache/CORP/CORS
đúng; Hà Nội → `400`; z sai → `400`. **Chưa thử trên Render + Vercel thật.**

## 5. Bật trên production và kiểm tra

1. Render → Environment: đặt `TILE_PROXY_USER_AGENT` (VD `ten-ung-dung/1.0 (mailto:email-nhom)`).
2. Thử backend: mở `https://<be>.onrender.com/api/tiles/13/6563/3822.png` → phải thấy ảnh Đà Lạt.
3. Vercel → Environment Variables: `VITE_DUNG_PROXY_TILE=true` → **Redeploy** (biến lúc build).
4. Mở `/map`, F12 → Network, lọc `tiles`: tile z11+ trong tỉnh đi tới `onrender.com/api/tiles/...`
   status 200; z8–10 vẫn là `/tiles/...` của chính trang.
5. **IP đúng người dùng:** zoom/pan liên tục ~1 phút trên 2 máy khác mạng — không máy nào gặp `429`.
6. **Cầu dao:** Render → Settings → **Suspend Web Service** → pan sang vùng chưa xem → sau vài tile thấy toast "đã chuyển sang tải bản đồ
   trực tiếp", bản đồ vẫn có nền. Nhớ **Resume** service sau khi thử.
7. **Không làm chậm SOS:** trong lúc 1 máy kéo bản đồ liên tục, máy khác gửi SOS (`SMS_DRY_RUN=true`) —
   commander vẫn thấy ngay.

Bước nào không đạt → Vercel đặt lại `VITE_DUNG_PROXY_TILE=false` + Redeploy. Không cần revert code.

## 6. Còn mở
- [ ] Chạy Mục 5 trên Render + Vercel thật, ghi kết quả vào CLAUDE.md Mục 15.29.
- [ ] Điều khoản sử dụng của `tile.openstreetmap.fr` vẫn chưa đọc được (CLAUDE.md Mục 15.12). Proxy
  dồn toàn bộ request về 1 IP — nếu bị chặn, cầu dao đưa mọi người về gọi thẳng như trước.
- [ ] Không cache RAM ở backend: mỗi tile mới vẫn tốn 1 lượt gọi upstream từ Render.

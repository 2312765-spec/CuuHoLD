# Triển khai (hosting) — Rescue GIS Lâm Đồng

> **Đã chốt (2026-11-25):** FE trên **Vercel**, BE trên **Render gói free + ping giữ thức**,
> DB là Supabase đang dùng, **tên miền mặc định** (`*.vercel.app`, `*.onrender.com`), SMS để
> `SMS_DRY_RUN=true` (chưa có Brandname eSMS, xem CLAUDE.md Mục 9). Cấu hình Vercel đã commit ở
> `frontend/vercel.json`; Render cấu hình tay theo **Mục 0** bên dưới. Mẫu Netlify / Cloudflare Pages
> ở Mục 1 chỉ để tham khảo. **Chưa có lần triển khai thật nào được kiểm chứng** — làm xong ghi kết
> quả vào Mục 3.

## 0. Thứ tự triển khai (Render + Vercel)

**Trước khi bắt đầu:**
- Xác nhận đã chạy `gis/12-create-sos-images.sql` và `gis/13-create-push-subscriptions.sql` trên
  Supabase (thiếu thì ảnh SOS / thông báo đẩy trả 500).
- Mật khẩu 3 tài khoản demo (CLAUDE.md Mục 12) trên DB thật không còn là `demo1234` — chạy lại
  `gis/06-seed-demo-users.sql` hoặc đặt mật khẩu mới trước buổi demo.
- Tạo secret RIÊNG cho production, không dùng lại của máy dev: `JWT_SECRET`, `JWT_REFRESH_SECRET`
  (`openssl rand -base64 32`, mỗi cái một lần), khoá VAPID (`npx web-push generate-vapid-keys`).

**Bước 1 — Backend trên Render** (New → Web Service → chọn repo):

| Mục | Giá trị |
|---|---|
| Root Directory | `backend` |
| Runtime / Node | Node, thêm biến `NODE_VERSION=20` (cùng bản CI) |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:prod` |
| Region | **Trùng region Supabase** (Supabase → Settings → General); lệch region mỗi truy vấn chậm thêm vài trăm ms |
| Instance | Free |
| Health Check Path | `/api/health` |

Biến môi trường (Environment):

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` (tắt Swagger `/api/docs`) |
| `TRUST_PROXY_HOPS` | `1` — **bắt buộc**, thiếu thì mọi người dùng chung IP proxy, rate limit đăng nhập chặn cả tỉnh |
| `DATABASE_URL` | Chuỗi **Session pooler** của Supabase (Connect → Session pooler, `aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`). Host trực tiếp `db.<ref>.supabase.co` chỉ có IPv6, Render có thể không gọi được. Ký tự `@` trong mật khẩu phải viết `%40` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | secret mới tạo ở trên |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `24h` / `7d` |
| `FRONTEND_URL` | Tạm để `https://example.com`, điền đúng ở Bước 3 |
| `SMS_DRY_RUN` | `true` |
| `ORS_API_KEY` | key OpenRouteService |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | khoá mới + `mailto:<email nhóm>` |
| `TILE_PROXY_USER_AGENT` | (tuỳ chọn) chỉ cần khi bật proxy tile — VD `ten-ung-dung/1.0 (mailto:<email nhóm>)` |
| `GEOCODE_USER_AGENT` | (tuỳ chọn) User-Agent gửi Nominatim khi tra tên đường; trống → dùng `TILE_PROXY_USER_AGENT` |

Kiểm tra: `curl https://<be>.onrender.com/api/health` → `"database": "up"`. Log Render phải có dòng
cảnh báo `SMS DRY RUN` lúc khởi động.

**Bước 2 — Frontend trên Vercel** (Add New → Project → chọn repo):
- Root Directory `frontend`; Framework Preset Vite; Build `npm run build`; Output `dist`; Node 20.
- Environment Variables (biến lúc build — đổi xong phải Redeploy):
  `VITE_API_BASE_URL=https://<be>.onrender.com/api`, `VITE_SOCKET_URL=https://<be>.onrender.com`,
  `VITE_BAT_SUA_HO_SO=true`, `VITE_BAT_LICH_SU_SOS=true`, `VITE_BAT_THONG_BAO_DAY=true` (chỉ khi
  Bước 1 đã có VAPID), `VITE_DUNG_PROXY_TILE=false` (proxy tile — bật theo
  `docs/tile-proxy-plan.md` Mục 5, sau khi phần còn lại đã chạy ổn).
- **Nguồn tile Stadia Maps** (CLAUDE.md Mục 15.31): `VITE_TILE_STADIA=true` + `VITE_STADIA_API_KEY=<key>`
  (key lấy ở Stadia → Client Dashboard → Property). Key nằm trong bundle — đặt giới hạn tên miền phía
  Stadia. Stadia lỗi/hết hạn mức → tự chuyển sang openstreetmap.fr. Bật Stadia thì để proxy tile tắt.
- FE và BE **phải** ở 2 tên miền khác nhau: rewrite của Vercel không proxy được WebSocket, Socket.IO
  nối thẳng tới Render.

**Bước 3 — Nối hai bên:** trên Render đặt `FRONTEND_URL=https://<fe>.vercel.app` (đúng `https`,
không `/` cuối) → Render tự redeploy. Chỉ nhận 1 origin nên URL **preview** của Vercel bị CORS chặn —
chỉ dùng URL production.

**Bước 4 — Ping giữ thức (UptimeRobot hoặc tương đương):** monitor HTTP(s) tới
`https://<be>.onrender.com/api/health`, chu kỳ 5 phút. Giảm (không loại bỏ hẳn) việc Render free ngủ
— xem Mục 2 về hệ quả với SOS. Gói free Render có ~750 giờ chạy/tháng cho cả tài khoản: đủ cho
**1** service chạy suốt tháng, không đủ cho 2. Đọc lại điều khoản Render về ping giữ thức trước khi bật.

**Bước 5 — Kiểm tra:** Mục 3.

## 1. Frontend (thư mục `frontend/`)

Frontend là trang tĩnh (Vue 3 + Vite + PWA). Build ra thư mục `frontend/dist/`, đưa thư mục đó
lên bất kỳ dịch vụ trang tĩnh nào.

### 1.1 Biến môi trường

| Biến | Ý nghĩa | Mặc định khi không đặt | Ví dụ khi FE và BE khác tên miền |
|---|---|---|---|
| `VITE_API_BASE_URL` | Gốc REST API, **có** `/api` ở cuối | `/api` (cùng tên miền với FE) | `https://api.example.com/api` |
| `VITE_SOCKET_URL` | Gốc Socket.IO, **không** có `/api` (client tự thêm `/socket.io`) | `/` (cùng tên miền với FE) | `https://api.example.com` |

- Đây là biến **lúc build**: Vite nhúng thẳng giá trị vào file JS. Đổi biến xong phải **build lại**,
  đặt biến lúc chạy trên máy chủ không có tác dụng.
- Không có bí mật nào ở đây — mọi thứ trong biến `VITE_*` đều lộ ra trình duyệt. Tuyệt đối không
  đặt khoá/secret vào biến `VITE_*`.
- Mẫu: `frontend/.env.example`. Đặt trên dịch vụ hosting (mục Environment Variables), hoặc tạo
  `frontend/.env` khi build trên máy (file này bị `.gitignore` chặn, không commit).
- Giá trị mặc định (`/api`, `/`) chỉ chạy được khi FE và BE **cùng tên miền** (có reverse proxy),
  hoặc khi chạy `npm run dev` / `npm run preview` (Vite tự proxy `/api` và `/socket.io` về
  `localhost:3000` — proxy này **không tồn tại** sau khi build).

### 1.2 Lệnh build

```bash
cd frontend
npm ci
npm run build        # = vue-tsc -b && vite build → frontend/dist/
```

Cấu hình trên dịch vụ hosting: thư mục gốc `frontend`, lệnh build `npm run build`, thư mục xuất
bản `dist`, Node 20 (cùng bản CI dùng).

### 1.3 Quy tắc SPA: mọi đường dẫn không phải file → `index.html`

App dùng Vue Router chế độ history (`/map`, `/rescuer`, `/dashboard`, `/ho-so`…). Mở thẳng hoặc F5
ở `/map` thì máy chủ phải trả `index.html`, nếu không sẽ ra 404.

Chỉ trả `index.html` khi **không có file thật** ở đường dẫn đó — các file trong `dist/` (`/assets/*`,
`/tiles/*`, `/data/*`, `sw.js`…) phải được trả nguyên. Cả 3 mẫu dưới đây đều theo đúng thứ tự đó.

**Vercel** — `vercel.json` (đặt trong `frontend/`):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

(Vercel kiểm tra file tĩnh trước rồi mới áp `rewrites`.)

**Netlify** — `frontend/public/_redirects` (Vite chép sang `dist/`):

```
/*    /index.html   200
```

**Cloudflare Pages** — không cần cấu hình: khi `dist/` **không** có `404.html`, Pages tự coi là
SPA và trả `index.html` cho đường dẫn không khớp file.

> ⚠️ Hệ quả của SPA fallback: một file **không tồn tại** (VD ô bản đồ offline ngoài mức zoom đã
> đóng gói `/tiles/7/...`) sẽ nhận về `index.html` với mã 200 thay vì 404. Code hiện tại đã chặn
> việc xin tile ngoài z8–10 (CLAUDE.md Mục 15.12), nhưng khi thêm tài nguyên tĩnh mới cần nhớ điều
> này.

### 1.4 Header bộ nhớ đệm — Service Worker và `index.html` KHÔNG được cache

Các file sau phải có `Cache-Control: no-cache` (trình duyệt luôn hỏi lại máy chủ). Cache lâu thì
người dùng kẹt ở bản cũ — với Service Worker còn tệ hơn: SW cũ tiếp tục phục vụ bản cũ, kể cả bản
có lỗi trong luồng gửi SOS.

| File | Lý do |
|---|---|
| `/index.html` | Trỏ tới file JS/CSS có hash mới sau mỗi lần build |
| `/sw.js` | Service Worker chính (vite-plugin-pwa sinh ra) |
| `/push-sw.js` | Nạp vào SW chính qua `importScripts` — thông báo đẩy |
| `/sos-sync-sw.js` | Nạp vào SW chính qua `importScripts` — gửi lại SOS khi có mạng |
| `/registerSW.js` | Đoạn đăng ký SW (khuyến nghị thêm) |
| `/manifest.webmanifest` | Tên/biểu tượng app cài đặt (khuyến nghị thêm) |

`/assets/*` có hash trong tên file → cache lâu được:
`Cache-Control: public, max-age=31536000, immutable`.

**Vercel** — thêm vào `vercel.json`:

```json
{
  "headers": [
    { "source": "/(index.html|sw.js|push-sw.js|sos-sync-sw.js|registerSW.js|manifest.webmanifest)",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

**Netlify / Cloudflare Pages** — `frontend/public/_headers` (cùng cú pháp ở cả hai):

```
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/push-sw.js
  Cache-Control: no-cache
/sos-sync-sw.js
  Cache-Control: no-cache
/registerSW.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Kiểm tra sau khi triển khai: DevTools → Network → chọn `sw.js` → xem header `Cache-Control`.

### 1.5 HTTPS là bắt buộc

Trình duyệt chỉ cho các tính năng sau chạy trên **HTTPS** (hoặc `http://localhost` khi thử trên máy):

- **Service Worker / PWA**: không có thì không cài app, không chạy offline, không có hàng đợi SOS
  gửi lại khi có mạng.
- **GPS (Geolocation)**: mở bằng `http://192.168.x.x` hay tên miền `http://` thì trình duyệt chặn
  hẳn — SOS sẽ gửi kèm cảnh báo "vị trí ước tính", nút "Vị trí của tôi" báo cần https.
- **Web Push**: thông báo đẩy cần SW nên cũng cần HTTPS.

Khi FE là `https://`, API và Socket.IO cũng phải là `https://` / `wss://` — trình duyệt chặn gọi
`http://` từ trang `https://` (mixed content).

### 1.6 ngrok chỉ để thử

ngrok tiện để thử trên điện thoại thật (có HTTPS nên GPS chạy được), nhưng **không dùng làm hosting**:
địa chỉ đổi mỗi lần chạy (bản miễn phí), máy cá nhân tắt là mất. Với ngrok: chạy `npm run dev` hoặc
`npm run preview` (có proxy `/api`, `/socket.io`) và để `VITE_API_BASE_URL=/api`,
`VITE_SOCKET_URL=/` — đường dẫn tương đối, xem CLAUDE.md Mục 15.12.

## 2. Việc cho thành viên B (backend)

- **`FRONTEND_URL` đúng tên miền FE** (VD `https://cuuho-lamdong.example.app`), đúng giao thức,
  **không** có `/` ở cuối. Biến này đang dùng cho CẢ CORS REST (`backend/src/main.ts`) LẪN CORS
  Socket.IO (`backend/src/sos/sos.gateway.ts`) — sai một ký tự là trình duyệt chặn cả hai.
  Hiện chỉ nhận **một** origin: nếu cần thêm tên miền xem trước (preview deploy) thì phải sửa code
  để nhận danh sách, không đặt `*` (CLAUDE.md Mục 4: không dùng `*` ở production).
- **CORS cho Socket.IO**: gateway đặt `credentials: true` — đi kèm origin cụ thể (không được `*`).
  Kiểm tra sau triển khai: mở `/dashboard`, DevTools → Network → WS, thấy kết nối
  `wss://…/socket.io/?EIO=4&transport=websocket` trạng thái 101.
- **Health check**: đặt health check của dịch vụ hosting BE về `GET /api/health` (đã có, không rate
  limit, xem `docs/api-contract.md`). Lưu ý endpoint vẫn trả 200 khi DB hỏng (`database: "down"`) —
  giám sát phải đọc trường `database`.
- **Gói miễn phí có thể "ngủ"** (VD Render free ngủ sau ~15 phút không có request, khởi động lại
  mất vài chục giây). Hệ quả với app cứu hộ:
  - `POST /api/sos` đầu tiên sau khi BE ngủ có thể quá thời gian chờ 8 giây của FE
    (`frontend/src/services/http.ts`) → FE coi như mất mạng và đưa SOS vào hàng đợi offline, gửi
    lại sau → **SOS tới trung tâm chậm**.
  - Socket.IO rớt khi BE ngủ, commander không nhận SOS mới theo thời gian thực cho tới khi nối lại.
  - Cách giảm: gói trả phí không ngủ, hoặc dịch vụ ping `GET /api/health` định kỳ (VD UptimeRobot
    5 phút/lần) — cần đọc điều khoản của nhà cung cấp về việc ping giữ thức.
- Biến môi trường BE khác (DB, JWT, eSMS…): xem CLAUDE.md Mục 9 và `backend/.env.example`.

## 3. Kiểm tra nhanh sau triển khai

1. Mở `https://<fe>/map` trực tiếp (không qua trang chủ) và F5 → hiện bản đồ, không 404.
2. DevTools → Application → Service Workers: `sw.js` đang chạy (activated).
3. Network: `sw.js`, `index.html` có `Cache-Control: no-cache`.
4. Đăng nhập → request tới `VITE_API_BASE_URL` thành công, không lỗi CORS trong Console.
5. Mở `/dashboard` bằng commander → WS `101 Switching Protocols`, chỉ báo "Thời gian thực: đang bật".
6. Trên điện thoại (HTTPS): bấm "Vị trí của tôi" → trình duyệt hỏi quyền vị trí.
7. **Rate limit theo đúng người** (`TRUST_PROXY_HOPS`): đăng nhập sai 6 lần từ máy A (lần 6 bị 429),
   rồi đăng nhập từ máy B ở mạng KHÁC (VD 4G) → máy B **không** bị 429. Nếu B cũng 429: số tầng proxy
   sai — thử `TRUST_PROXY_HOPS` khác và ghi lại số đúng vào Mục 0.
8. **Trọn luồng SOS** (an toàn nhờ `SMS_DRY_RUN=true`): victim gửi SOS trên điện thoại → commander
   thấy ngay trên `/dashboard` → rescuer được phân công thấy nhiệm vụ + tuyến đường ORS → victim huỷ
   → dashboard tự cập nhật không cần F5. Log Render có `[SMS DRY RUN]`, không có tin SMS thật.
9. Để BE ngủ (tắt ping ~20 phút) rồi gửi SOS: ghi lại SOS tới ngay hay vào hàng đợi offline.

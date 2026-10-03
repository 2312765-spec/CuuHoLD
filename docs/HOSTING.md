# Triển khai (hosting) — Rescue GIS Lâm Đồng

> Tài liệu mẫu, **chưa chọn nhà cung cấp**. Các đoạn cấu hình Vercel / Netlify / Cloudflare Pages
> dưới đây chỉ để tham khảo — chưa có file cấu hình nào của nhà cung cấp được commit vào repo.
> Chưa có lần triển khai thật nào được kiểm chứng theo tài liệu này.

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

# API Contract — Rescue GIS Lâm Đồng

> Nguồn: đọc trực tiếp từ code (`backend/src`), cập nhật lần cuối sau khi `SosController`,
> `RescueTeamsController` được code đầy đủ (không còn là stub). Chỉ liệt kê endpoint
> **đã implement** — endpoint nào không có ở đây nghĩa là chưa tồn tại trong code, đừng
> gọi. Đối chiếu domain model (enum, field) với `shared/socket-events.types.ts` — 2 file
> đó và file này phải luôn khớp nhau.
>
> Base URL: `http://localhost:3000/api` (dev, xem `main.ts` — `app.setGlobalPrefix('api')`).

---

## 0. Quy ước chung (đọc trước khi code bất kỳ service nào ở frontend)

### Response thành công
```json
{ "success": true, "data": /* T */, "message": "..." }
```
`data` không bao giờ `null`/thiếu khi `success:true`. Luôn unwrap `response.data.data`.

> ⚠️ **Ngoại lệ duy nhất:** `GET /api/sos/mine/active` (Mục 2) trả `data: null` có chủ đích
> khi victim không có SOS nào đang hoạt động — đây là kết quả hợp lệ (giống "get current
> cart" trả rỗng), không phải lỗi, nên không ép về `404`. Mọi route khác vẫn giữ đúng quy
> ước "data không bao giờ null" ở trên.

### Response lỗi — **KHÔNG cùng shape với response thành công**
Backend chưa có global exception filter, nên lỗi trả về đúng format mặc định của NestJS,
**không có field `success`**:
```json
{ "statusCode": 400, "message": "Sai thông tin đăng nhập", "error": "Bad Request" }
```
Với lỗi validate DTO (`class-validator`, `whitelist: true, forbidNonWhitelisted: true`),
`message` là **mảng string**, không phải string đơn:
```json
{ "statusCode": 400, "message": ["lat must not be less than -90", "type must be a valid enum value"], "error": "Bad Request" }
```
→ Ở frontend, interceptor lỗi trong `http.ts` phải xử lý cả 2 dạng `message` (string | string[]),
không được giả định `error.response.data.success === false`.

### Mã lỗi chuẩn dùng trong toàn bộ API
| Status | Khi nào |
|---|---|
| `400 Bad Request` | DTO validate fail, hoặc business rule fail (VD: sai transition trạng thái SOS) |
| `401 Unauthorized` | Thiếu/sai `Authorization: Bearer <token>`, sai phone/password, tài khoản bị khoá |
| `403 Forbidden` | Đúng JWT nhưng sai role, hoặc không sở hữu resource (VD: rescuer cập nhật SOS không phải đội mình) |
| `404 Not Found` | Không tìm thấy SOS / đội cứu hộ theo `id` |
| `409 Conflict` | `phone` đã tồn tại khi đăng ký |

### Auth header
Mọi route có 🔒 bên dưới đều cần:
```
Authorization: Bearer <accessToken>
```
Thiếu → `401`. Đúng token nhưng sai role → `403` (`RolesGuard`, message `"Không có quyền truy cập"`).

### PostGIS — quy ước toạ độ
Mọi request/response body dùng `lat`/`lng` riêng biệt (không phải GeoJSON). Nội bộ backend
convert sang `ST_MakePoint(lng, lat)` — **frontend không cần quan tâm thứ tự này, chỉ cần
gửi đúng field `lat`/`lng` như spec dưới**.

### ⚠️ Rate limit trong CLAUDE.md — CHƯA implement
CLAUDE.md Mục 10 mô tả rate limit (5 SOS/giờ/user, 5 login/15 phút/IP, 3 đăng ký/giờ/IP)
nhưng **backend hiện KHÔNG có `@nestjs/throttler` hay middleware giới hạn nào** — gọi
liên tục không bị chặn. Đừng code frontend dựa trên giả định có rate limit ở server.

---

## 1. Auth (`/api/auth`)

### POST /api/auth/register
Public.

**Body**
```json
{
  "phone": "0901234567",       // bắt buộc, regex ^0\d{9,10}$
  "name": "Nguyễn Văn A",      // bắt buộc, 2-100 ký tự
  "password": "matkhau123",    // bắt buộc, tối thiểu 8 ký tự
  "role": "victim",            // optional, enum victim|rescuer|commander, default victim
  "wardCode": "24823"          // bắt buộc — mã xã/phường (ma_xa), KHÔNG còn districtCode
}
```

**201 Created**
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "id": "uuid", "phone": "0901234567", "name": "Nguyễn Văn A",
      "role": "victim", "wardCode": "24823", "isActive": true,
      "createdAt": "...", "updatedAt": "..."
    },
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 86400
  }
}
```
`user` không chứa `passwordHash`. Lỗi: `409` nếu `phone` đã tồn tại.

### POST /api/auth/login
Public. `@HttpCode(200)` — trả **200**, không phải 201.

**Body**: `{ "phone": "0901234567", "password": "matkhau123" }`

**200 OK**: shape `data` giống hệt `/register` (`user`, `accessToken`, `refreshToken`, `expiresIn`).
Lỗi: `401` nếu sai phone/password **hoặc** tài khoản bị khoá (`isActive=false`) — cùng
message, không phân biệt để tránh lộ thông tin tài khoản tồn tại.

### GET /api/auth/me 🔒
**200 OK**
```json
{ "success": true, "message": "OK", "data": { "id": "...", "phone": "...", "role": "...", "wardCode": "...", "isActive": true, "createdAt": "...", "updatedAt": "..." } }
```
(không có `passwordHash`)

> ⚠️ `POST /api/auth/refresh` có trong CLAUDE.md Mục 7 nhưng **chưa implement** — không có
> route này trong `auth.controller.ts`. Khi `accessToken` hết hạn (24h), phải bắt user
> đăng nhập lại; đừng code luồng silent-refresh.

---

## 2. SOS (`/api/sos`) 🔒 — tất cả route đều cần JWT

### POST /api/sos
Role: `victim`.

**Body**
```json
{
  "lat": 11.9465,             // bắt buộc, -90..90
  "lng": 108.4419,            // bắt buộc, -180..180
  "type": "flood",            // bắt buộc, enum: flood|landslide|accident|medical|fire|lost|drowning|agricultural|adventure|other
  "description": "...",       // optional
  "imageUrl": "https://..."   // optional
}
```
Backend **tự suy ra `wardCode`** từ `lat/lng` qua trigger DB (`ST_Contains`) — không gửi
`wardCode` trong body, có gửi cũng bị `ValidationPipe` (`forbidNonWhitelisted`) từ chối với `400`.

**201 Created**
```json
{
  "success": true,
  "message": "Đã gửi tín hiệu SOS",
  "data": {
    "id": "uuid",
    "type": "flood",
    "status": "pending",
    "ward_code": "24823",
    "created_at": "2026-09-03T08:00:00.000Z",
    "cancel_deadline": "2026-09-03T08:03:00.000Z"
  }
}
```
⚠️ **Field trong `data` là `snake_case`** (`ward_code`, `created_at`, `cancel_deadline`) —
khác với payload Socket.io tương ứng (`SosNewPayload`) là `camelCase`. Đừng dùng chung 1
interface cho cả 2, map riêng.

Ngay sau khi tạo, backend emit Socket.io `sos:new` vào room `ward:{wardCode}` +
`province:lamdong`, và gọi SMS dự phòng (không block response).

### GET /api/sos
Role: `rescuer` (chỉ SOS trong `wardCode` của mình) hoặc `commander` (toàn tỉnh).
`victim` gọi route này bị `403` (không có trong `@Roles`) — victim dùng `GET /api/sos/:id`
để xem SOS của chính mình.

**Query params**
| Tên | Bắt buộc | Ghi chú |
|---|---|---|
| `status` | optional | 1 hoặc nhiều status cách nhau bởi dấu phẩy, VD `status=pending,assigned`. Giá trị không hợp lệ bị lọc bỏ âm thầm (không lỗi). |

**200 OK** — tối đa 50 kết quả, sắp xếp mới nhất trước:
```json
{
  "success": true, "message": "OK",
  "data": [
    {
      "id": "uuid", "type": "flood", "status": "pending", "ward_code": "24823",
      "created_at": "...", "lat": 11.9465, "lng": 108.4419,
      "victim_name": "Nguyễn Văn A", "victim_phone": "0901234567"
    }
  ]
}
```

### GET /api/sos/mine/active
Role: `victim`. Trả về SOS **chưa kết thúc** (khác `resolved`/`cancelled`/`false_alarm`) mới
nhất của chính người gọi, kèm `timeline` — cùng shape với `GET /api/sos/:id`. Dùng để
frontend khôi phục marker/thẻ theo dõi SOS sau khi F5 xoá sạch state RAM (`useSos.ts` —
trước đây không có cách hỏi lại vì `GET /api/sos` chặn role `victim`, còn `GET /api/sos/:id`
cần biết trước `id`, đúng cái bị mất lúc reload).

**200 OK — có SOS đang hoạt động**: shape giống hệt `GET /api/sos/:id`.
**200 OK — không có SOS nào đang hoạt động**: `{ "success": true, "data": null, "message": "Không có SOS nào đang hoạt động" }`
(xem ngoại lệ `data:null` ở Mục 0).

### GET /api/sos/:id
JWT bắt buộc, không giới hạn role trong decorator — nhưng service tự kiểm tra quyền:
`victim` chỉ xem được SOS của chính mình (`403` nếu không phải), `rescuer` chỉ xem được
SOS cùng `wardCode` (`403` nếu khác), `commander` xem được tất cả.

**200 OK**
```json
{
  "success": true, "message": "OK",
  "data": {
    "id": "uuid", "victim_id": "uuid", "type": "flood", "status": "assigned",
    "description": null, "image_url": null, "ward_code": "24823",
    "false_alarm_count": 0, "cancel_deadline": "...",
    "created_at": "...", "updated_at": "...", "resolved_at": null,
    "lat": 11.9465, "lng": 108.4419,
    "assigned_team_id": "uuid", "team_name": "Đội cứu hộ Đà Lạt 1", "team_status": "busy",
    "victim_name": "Nguyễn Văn A", "victim_phone": "0901234567",
    "timeline": [
      { "id": "uuid", "actor_id": "uuid", "action": "assigned", "note": null, "created_at": "..." }
    ]
  }
}
```

### PATCH /api/sos/:id/cancel
Role: `victim`, phải là chủ SOS (`403` nếu không phải).

**Body**
```json
{ "reason": "mistake" }   // bắt buộc, enum: mistake | resolved_myself | other
```

**200 OK**
```json
{ "success": true, "message": "Đã hủy SOS", "data": { "sosId": "uuid", "status": "cancelled", "penaltyApplied": false } }
```
`penaltyApplied = true` nếu hủy **sau** `cancel_deadline` (3 phút kể từ lúc tạo). Lỗi
`400` nếu SOS đã ở trạng thái kết thúc (`resolved`/`cancelled`/`false_alarm`).

> ⚠️ Backend hiện **chưa cộng dồn `false_alarm_count` / auto-flag tài khoản sau 3 lần
> phạt** như mô tả CLAUDE.md Mục 10 — `cancel()` chỉ update `status`, không đụng tới
> `false_alarm_count`. Đừng hiển thị UI "cảnh báo tài khoản" dựa trên field này ở FE vì
> backend chưa tính.

### PATCH /api/sos/:id/assign
Role: `commander`.

**Body**
```json
{ "teamId": "uuid" }   // bắt buộc, UUID hợp lệ
```

**200 OK**
```json
{
  "success": true, "message": "Đã phân công đội cứu hộ",
  "data": { "sosId": "uuid", "teamId": "uuid", "status": "assigned", "wardCode": "24823", "updatedAt": "..." }
}
```
⚠️ Field trong `data` ở đây là **camelCase** (khác `create`/`findAll` là snake_case).
Lỗi `400` nếu SOS không ở trạng thái `pending`, hoặc đội cứu hộ không `available`.
Lỗi `404` nếu `sosId`/`teamId` không tồn tại.
Emit Socket.io `sos:updated` vào room `sos:{sosId}` + `ward:{wardCode}`.

### PATCH /api/sos/:id/status
Role: `rescuer`, và phải là **leader của đội đang được assign** SOS đó (`403` nếu không
phải, kể cả nếu SOS chưa có đội nào được assign).

**Body**
```json
{ "status": "in_progress", "note": "..." }  // status bắt buộc, enum: in_progress|arrived|resolved. note optional
```

Thứ tự chuyển trạng thái **duy nhất hợp lệ**: `assigned → in_progress → arrived → resolved`.
Gửi sai thứ tự (VD nhảy cóc `assigned → resolved`) → `400`
(`"Không thể chuyển trạng thái từ 'assigned' sang 'resolved'"`).
Khi chuyển sang `resolved`, backend tự set `resolved_at` và đưa đội cứu hộ về `status='available'`.

**200 OK**
```json
{ "success": true, "message": "Đã cập nhật tiến độ", "data": { "sosId": "uuid", "status": "in_progress", "updatedAt": "..." } }
```

---

## 3. GIS (`/api/gis`) 🔒 — role `commander` cho cả 2 endpoint

### GET /api/gis/nearest-teams
Tìm đội cứu hộ `available` gần một toạ độ (PostGIS `ST_DWithin` + `ST_Distance`).

**Query params**
| Tên | Bắt buộc | Ghi chú |
|---|---|---|
| `lat` | ✅ | -90..90 |
| `lng` | ✅ | -180..180 |
| `radiusMeters` | optional | mặc định 10000 nếu bỏ trống ở query string, tối thiểu 1 |
| `limit` | optional | mặc định 5, 1..50 |

**200 OK**
```json
{
  "success": true, "message": "OK",
  "data": [
    {
      "id": "uuid", "name": "Đội cứu hộ Đà Lạt 1", "status": "available",
      "specialties": ["flood", "medical"],
      "lat": 11.9465, "lng": 108.4419,
      "distance_meters": 1234, "eta_minutes": 2,
      "leader_name": "Trần Văn B", "leader_phone": "0901234567"
    }
  ]
}
```
`eta_minutes` là ước tính thô (khoảng cách / 40km/h), không phải routing thật.

### GET /api/gis/sos-heatmap
Tổng hợp số lượng SOS theo vị trí + xã/phường trong khoảng thời gian.

**Query params**
| Tên | Bắt buộc | Ghi chú |
|---|---|---|
| `from` | ✅ | ISO 8601, VD `2026-08-01T00:00:00.000Z` |
| `to` | ✅ | ISO 8601 |

**200 OK**
```json
{
  "success": true, "message": "OK",
  "data": [ { "lat": 11.9465, "lng": 108.4419, "ward_code": "24823", "incident_count": 7 } ]
}
```
Sắp xếp `incident_count` giảm dần.

---

## 4. Rescue Teams (`/api/rescue-teams`) 🔒

### GET /api/rescue-teams
Role: `commander`.

**200 OK**
```json
{
  "success": true, "message": "OK",
  "data": [
    {
      "id": "uuid", "name": "Đội cứu hộ Đà Lạt 1", "status": "available",
      "specialties": ["flood", "medical"], "ward_code": "24823",
      "lat": 11.9465, "lng": 108.4419,
      "leader_name": "Trần Văn B", "leader_phone": "0901234567"
    }
  ]
}
```
`lat`/`lng` có thể là `null` nếu đội chưa từng gửi vị trí (`current_location IS NULL`).

### PATCH /api/rescue-teams/:id/location
Role: `rescuer`, phải là **leader** của đội đó (`403` nếu không phải, `404` nếu `id` không tồn tại).

**Body**: `{ "lat": 11.9465, "lng": 108.4419 }` — cả 2 bắt buộc, đúng range như SOS.

**200 OK**
```json
{ "success": true, "message": "Đã cập nhật vị trí", "data": { "teamId": "uuid", "wardCode": "24823", "lat": 11.9465, "lng": 108.4419, "updatedAt": "..." } }
```
Emit Socket.io `team:location-updated` vào `ward:{wardCode}` + `province:lamdong`.

> Cùng logic này còn dùng được qua Socket.io event `team:update-location` (xem Mục 5) —
> rescuer có thể chọn gọi REST hoặc emit socket, kết quả tương đương. CLAUDE.md gợi ý dùng
> socket để gửi GPS mỗi 30s (đỡ overhead HTTP), dùng REST cho các thao tác rời rạc.

### PATCH /api/rescue-teams/:id/status
Role: `rescuer`, phải là leader của đội đó.

**Body**: `{ "status": "available" }` — enum `available | busy | offline`.

**200 OK**
```json
{ "success": true, "message": "Đã cập nhật trạng thái", "data": { "teamId": "uuid", "status": "available", "updatedAt": "..." } }
```

---

## 5. Socket.IO — thông tin cần cho frontend (chi tiết event xem CLAUDE.md Mục 8)

Backend chỉ có **1 gateway**, chạy chung port với HTTP (`http://localhost:3000`, không
phải port riêng).

**Handshake bắt buộc** — `handleConnection()` verify JWT ngay khi connect, disconnect nếu
sai/thiếu:
```ts
io('http://localhost:3000', { auth: { token: accessToken } })
```
Token **không có tiền tố `Bearer `** trong `handshake.auth.token` (backend tự strip nếu có,
nhưng gửi token trần là chuẩn). Sai/thiếu token → server gọi `client.disconnect()` ngay,
không có error event nào bắn ra — phía frontend chỉ thấy `disconnect`.

Room được tự động join theo JWT payload, **frontend không tự `emit('join', ...)`**:
- `ward:{wardCode}` — nếu user có `wardCode`
- `province:lamdong` — nếu `role === 'commander'`

Danh sách event + payload: dùng đúng `SOCKET_EVENTS` từ `shared/socket-events.types.ts`,
không tự định nghĩa lại tên event hay field (xem checklist tích hợp Phase 1/4 tại
`docs/frontend-integration-checklist.md`). Toàn bộ payload socket dùng **camelCase**
(khác với response REST của `POST /api/sos` là snake_case — xem cảnh báo ở Mục 2).

---

## 6. Chưa implement / khác với CLAUDE.md

- `POST /api/auth/refresh` — không có route.
- Rate limiting (5 SOS/giờ, 5 login/15 phút, 3 đăng ký/giờ) — không có `ThrottlerGuard` nào trong code.
- `false_alarm_count` tăng dần + auto-flag tài khoản sau 3 lần phạt — `cancel()` chưa cập nhật field này.
- `GET /api/ranhgioi` (ranh giới xã/phường qua API) — không tồn tại và **sẽ không được thêm**;
  dùng file tĩnh `public/data/lamdong-wards.geojson` ở frontend (theo CLAUDE.md Mục 5).

---

*File này phải được cập nhật lại mỗi khi controller/DTO backend đổi — đọc code, không suy
đoán từ CLAUDE.md, vì CLAUDE.md mô tả spec dự kiến còn file này mô tả **những gì code thật
đang trả về**.*

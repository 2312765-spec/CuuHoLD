# API Contract — Rescue GIS Lâm Đồng

> Nguồn: đọc trực tiếp từ code (`backend/src`). Chỉ liệt kê endpoint **đã implement**.
> Danh sách đầy đủ endpoint dự kiến cho MVP xem CLAUDE.md Mục 7 — các endpoint chưa
> có ở đây (SOS, rescue-teams) nghĩa là controller còn là stub rỗng, chưa code.
>
> Base URL: `http://localhost:3000/api` (dev). Response envelope chung:
> `{ success: boolean, data: T, message: string }`.

---

## Auth

### POST /api/auth/register
Public. Đăng ký tài khoản mới.

**Body**
```json
{
  "phone": "0901234567",       // bắt buộc, regex ^0\d{9,10}$
  "name": "Nguyễn Văn A",      // bắt buộc, 2-100 ký tự
  "password": "matkhau123",    // bắt buộc, tối thiểu 8 ký tự
  "role": "victim",            // optional, enum victim|rescuer|commander, default victim
  "districtCode": "672",       // bắt buộc
  "wardCode": "67201"          // optional
}
```

**201 Created**
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": { "id": "...", "phone": "...", "name": "...", "role": "victim",
               "districtCode": "672", "wardCode": null, "isActive": true,
               "createdAt": "...", "updatedAt": "..." },
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 86400
  }
}
```
`user` không chứa `passwordHash`. Lỗi: `409 Conflict` nếu `phone` đã tồn tại.

### POST /api/auth/login
Public.

**Body**: `{ "phone": "0901234567", "password": "matkhau123" }`

**201 Created**: giống response của `/register` (không có field `wardCode` khác biệt).
Lỗi: `401 Unauthorized` nếu sai phone/password hoặc tài khoản bị khoá (`isActive=false`).

### GET /api/auth/me
Cần `Authorization: Bearer <accessToken>`.

**200 OK**
```json
{ "success": true, "message": "OK", "data": { "id": "...", "phone": "...", "role": "...", ... } }
```
(không có `passwordHash`)

> ⚠️ `POST /api/auth/refresh` có trong Mục 7 CLAUDE.md nhưng **chưa được implement** trong `auth.controller.ts`.

---

## GIS

Cả 2 endpoint dưới đây yêu cầu `Authorization: Bearer <accessToken>` **và** role `commander`
(`JwtAuthGuard` + `RolesGuard` + `@Roles('commander')`). Sai role → `403 Forbidden`
(`"Không có quyền truy cập"`). Thiếu/token sai → `401 Unauthorized`.

### GET /api/gis/nearest-teams
Tìm đội cứu hộ `available` gần một toạ độ, dùng PostGIS (`ST_DWithin` + `ST_Distance`).

**Query params**
| Tên | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `lat` | number | ✅ | -90..90 |
| `lng` | number | ✅ | -180..180 |
| `radiusMeters` | number | optional | mặc định 10000, tối thiểu 1 |
| `limit` | number | optional | mặc định 5, 1..50 |

**200 OK**
```json
{
  "success": true,
  "message": "OK",
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

### GET /api/gis/sos-heatmap
Tổng hợp số lượng SOS theo vị trí + huyện trong khoảng thời gian, dùng để vẽ heatmap.

**Query params**
| Tên | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `from` | string (ISO 8601) | ✅ | ví dụ `2026-08-01T00:00:00.000Z` |
| `to` | string (ISO 8601) | ✅ | |

**200 OK**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    { "lat": 11.9465, "lng": 108.4419, "district_code": "672", "incident_count": 7 }
  ]
}
```
Sắp xếp `incident_count` giảm dần.

---

## Chưa implement (xem CLAUDE.md Mục 7)

- `POST /api/auth/refresh`
- Toàn bộ `SosController` (`POST/GET /api/sos`, `PATCH /api/sos/:id/*`) — controller hiện là stub rỗng.
- Toàn bộ `RescueTeamsController` — module chưa tồn tại trong `backend/src`.

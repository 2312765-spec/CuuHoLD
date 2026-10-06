# CLAUDE.md — Rescue GIS Lâm Đồng
> **Đọc file này trước khi sinh bất kỳ dòng code nào.**
> Áp dụng cho: Claude Code, Cursor IDE, GitHub Copilot, Gemini CLI.

---

## 1. Dự án là gì?

**Rescue GIS Lâm Đồng** — Web App cứu hộ khẩn cấp tỉnh Lâm Đồng.

Người dân nhấn SOS → tọa độ GPS gửi lên server → WebSocket phát real-time lên bản đồ của trung tâm chỉ huy → đội cứu hộ gần nhất (PostGIS tính) được điều phối → SMS eSMS gửi dự phòng khi mất internet.

**3 vai trò:** `victim` (gửi SOS) · `rescuer` (nhận nhiệm vụ) · `commander` (giám sát + điều phối)

---

## 2. Stack & Phân công

```
rescue-gis-lamdong/          ← Monorepo
├── backend/                 ← NestJS (Thành viên B)
├── frontend/                ← Vue 3 (Thành viên A)
└── gis/queries.sql          ← PostGIS SQL (Thành viên C)
```

| Tầng | Công nghệ | Người phụ trách |
|---|---|---|
| Frontend | Vue 3 + TypeScript + Leaflet.js + Vite + PWA | A |
| Backend | NestJS v10 + TypeScript + Socket.io | B |
| Database | PostgreSQL 15 + PostGIS (Supabase) | B + C |
| GIS Queries | PostGIS SQL (viết trong `gis/queries.sql`) | C |
| SMS | eSMS.vn REST API (không dùng SDK, dùng axios) | B |
| Routing | OpenRouteService (openrouteservice.org, free tier, dựa trên OSM) — dẫn đường thật cho RescuerView, không gọi Google Maps API. Xem Mục 15.13 | B |
| Deploy | Vercel (FE) + Render.com (BE) + Supabase (DB) | B |

---

## 3. AI Skills được dùng trong dự án này

> Các AI Skills dưới đây đã được chọn lọc từ cộng đồng. Tham chiếu khi sinh code.

### 3.1 Skills cho Backend (NestJS)

**`Kadajett/agent-nestjs-skills`** *(cài bằng: `npx skills add Kadajett/agent-nestjs-skills`)*
- Áp dụng NestJS best practices: module/controller/service phân tách rõ ràng
- Enforce class-validator trong mọi DTO
- Tránh anti-patterns: không inject repository trực tiếp vào controller

**`j4flmao/agent_skills_nodejs_nestjs`** *(copy `.agents/` vào project root)*
- OOP-first, generic-typed, low coupling — high cohesion
- Kiến trúc: transport layer ≠ business logic ≠ persistence
- Hữu ích khi thiết kế SosModule, GisModule

**NestJS Anti-Hallucination Rules** *(từ `PatrickJS/awesome-cursorrules`)*
- Chặn decorator sai, import phantom, provider không tồn tại
- Copy vào `.github/copilot-instructions.md` (xem Mục 4 bên dưới)

**`owasp-security` skill** *(từ `BehiSecc/awesome-claude-skills`)*
- OWASP Top 10:2025 + ASVS 5.0
- Áp dụng khi review: JWT, bcrypt, parameterized queries, rate limiting

### 3.2 Skills cho Frontend (Vue 3)

**Vue 3 Composition API Rules** *(từ `PatrickJS/awesome-cursorrules`)*
- Luôn dùng `<script setup lang="ts">` — không dùng Options API
- Composables cho logic tái sử dụng
- File path: `rules/vue3-composition-api-cursorrules-prompt-file/.cursorrules`

**Vue 3 + TypeScript Development Rules** *(từ `PatrickJS/awesome-cursorrules`)*
- Strict typing, no `any`, interface rõ ràng
- Pinia store pattern: state → getters → actions
- File path: `rules/vue-3-nuxt-3-development-cursorrules-prompt-file/.cursorrules`

**`webapp-testing` skill** *(từ Anthropic official skills)*
- Playwright testing cho các flow SOS end-to-end
- Test cross-browser trên Chrome (mobile emulation)

### 3.3 Skills cho GIS & Security

**`varlock-claude-skill`** *(bảo vệ secrets)*
- Đảm bảo ESMS_API_KEY, JWT_SECRET không lộ trong code/logs/git
- Tự động scan trước khi commit

**`sanitize` skill** *(từ openclaw/skills)*
- Phát hiện và redact PII: số điện thoại, tọa độ GPS nạn nhân trong logs

**`systematic-debugging`** *(khi gặp bug)*
- Quy trình debug PostGIS query sai kết quả
- Đặc biệt hữu ích khi ST_MakePoint trả về kết quả không đúng

### 3.4 AI Coding Rules (`.github/copilot-instructions.md`)

Tổng hợp 3 nguồn vào 1 file duy nhất. Team dùng **VS Code**, không dùng Cursor
IDE, nên file thật nằm ở `.github/copilot-instructions.md` (VS Code/GitHub
Copilot Chat tự động đọc file này) thay vì `.cursorrules` (Cursor-only). Nội
dung xem Mục 4:
- NestJS Anti-Hallucination (PatrickJS/awesome-cursorrules)
- Vue 3 Composition API rules
- TypeScript strict rules

---

## 4. Nội dung AI Coding Rules

> File thật: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
> (KHÔNG phải `.cursorrules` — team dùng VS Code, Cursor IDE không nằm trong
> workflow hiện tại). Xem Mục 15.1 để biết lý do đổi vị trí.

```
# ═══════════════════════════════════════════
# RESCUE GIS LÂM ĐỒNG — AI CODING RULES
# Nguồn: PatrickJS/awesome-cursorrules (tổng hợp)
# ═══════════════════════════════════════════

## IDENTITY
You are a senior TypeScript developer building a GIS-based rescue coordination
web app for Lâm Đồng province, Vietnam. Stack: NestJS (backend) + Vue 3 (frontend)
+ PostgreSQL + PostGIS + Socket.io + eSMS.vn.

## NESTJS RULES (Anti-Hallucination)

### BANNED — Never generate these:
- @nestjs/mongoose or any MongoDB-related imports (dự án dùng PostgreSQL)
- @nestjs/microservices (out of scope for MVP)
- @InjectModel() decorator (Mongoose-only, không dùng TypeORM)
- createParamDecorator from wrong path
- app.useWebSocketAdapter() without proper import
- PassportStrategy without correct super() call

### REQUIRED patterns:
- Every DTO MUST use class-validator decorators (@IsString, @IsNumber, etc.)
- Every controller method MUST have @ApiOperation() for Swagger
- Every protected route MUST have @UseGuards(JwtAuthGuard)
- Services MUST be injected via constructor, never instantiated directly
- Raw SQL (PostGIS) MUST use parameterized queries — never string concatenation

### Module structure (always follow this order):
1. Entity file (*.entity.ts)
2. DTO files (dto/*.dto.ts) with class-validator
3. Service (*.service.ts) — business logic only
4. Gateway (*.gateway.ts) — WebSocket only if needed
5. Controller (*.controller.ts) — HTTP only
6. Module (*.module.ts) — wire everything together

## VUE 3 RULES

### REQUIRED:
- ALWAYS use <script setup lang="ts"> — NEVER Options API
- ALWAYS type refs: ref<Type>() — never ref<any>()
- Reusable logic → composables in src/composables/use*.ts
- API calls → src/services/*.service.ts (never directly in components)
- Global state → Pinia store in src/stores/*.store.ts

### BANNED:
- this.$emit or this.$props (Options API patterns)
- defineComponent() without script setup
- any localStorage usage (not supported in artifacts)
- Direct DOM manipulation (use Vue refs instead)

## POSTGIS RULES (Critical)

### ALWAYS remember:
- ST_MakePoint(longitude, latitude) — longitude FIRST, latitude SECOND
- Correct: ST_SetSRID(ST_MakePoint(108.44, 11.94), 4326)
- Wrong:   ST_SetSRID(ST_MakePoint(11.94, 108.44), 4326)  ← Bug!
- Cast geography for distance: location::geography
- GiST index REQUIRED on geometry columns for performance

### Distance query template:
ST_Distance(col::geography, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography)
ST_DWithin(col::geography, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radius_meters)

## SECURITY RULES (OWASP)

- bcrypt MINIMUM cost factor: 12
- JWT expiry: accessToken=24h, refreshToken=7d — never 'never'
- ALWAYS parameterized queries — NEVER string interpolation in SQL
- Rate limit: 5 SOS/hour/user, 5 logins/15min/IP
- helmet() MUST be first middleware in main.ts
- CORS: only allow FRONTEND_URL — never '*' in production
- Environment variables: NEVER hardcode secrets in source code

## WEBSOCKET RULES

- ALWAYS verify JWT in handleConnection() before joining rooms
- Disconnect client immediately if token invalid: client.disconnect()
- Room naming: ward:{ward_code} and province:lamdong
- Emit event names MUST match shared/socket-events.types.ts exactly
- camelCase for ALL payload field names — NEVER snake_case

## TYPESCRIPT RULES

- strict: true in tsconfig — no exceptions
- NEVER use 'any' type — use unknown and type guards instead
- Shared types in shared/socket-events.types.ts — import, don't redefine
- Interfaces for data shapes, types for unions/aliases
- Return types MUST be explicit on all public methods

## WHAT NOT TO BUILD (out of scope for MVP)

- Docker / docker-compose
- Redis caching
- Microservices architecture
- Mobile native app (iOS/Android)
- LoRa Mesh integration
- GraphQL
- MongoDB / Mongoose
```

---

## 5. Cấu trúc thư mục đầy đủ

```
rescue-gis-lamdong/
├── CLAUDE.md                          ← file này
├── .github/
│   └── copilot-instructions.md        ← Mục 4 ở trên (VS Code đọc tự động)
├── .gitignore
├── README.md
│
├── shared/
│   └── socket-events.types.ts         ← Types chung A và B đều import
│
├── docs/
│   ├── api-contract.md                ← REST API contract (B viết, A review)
│   └── SOCKET_EVENTS.md               ← WebSocket contract
│
├── gis/
│   ├── 01-schema-wards.sql             ← Bảng wards (xã/phường) + RLS + GiST index
│   ├── 02-seed-wards.sql               ← 123/124 xã/phường Lâm Đồng mới (thiếu Đam Rông 2,
│   │                                      xem frontend/public/data/README.md)
│   ├── 03-migrate-existing-tables.sql  ← users/sos_requests: district_code → ward_code
│   └── queries.sql                     ← PostGIS queries khác (C viết, B dùng)
│
├── backend/                           ← NestJS
│   ├── src/
│   │   ├── main.ts                    ← helmet, CORS, Swagger, ValidationPipe
│   │   ├── app.module.ts              ← TypeORM + ConfigModule
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts     ← /api/auth/*
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/register.dto.ts
│   │   │   ├── dto/login.dto.ts
│   │   │   ├── strategies/jwt.strategy.ts
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── roles.guard.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── user.entity.ts
│   │   ├── sos/
│   │   │   ├── sos.module.ts
│   │   │   ├── sos.controller.ts      ← /api/sos/*
│   │   │   ├── sos.service.ts
│   │   │   ├── sos.gateway.ts         ← Socket.io WebSocket
│   │   │   ├── sos.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-sos.dto.ts
│   │   │       └── update-sos-status.dto.ts
│   │   ├── rescue-teams/
│   │   │   ├── rescue-teams.module.ts
│   │   │   ├── rescue-teams.controller.ts
│   │   │   ├── rescue-teams.service.ts
│   │   │   └── rescue-team.entity.ts
│   │   ├── gis/
│   │   │   ├── gis.module.ts
│   │   │   ├── gis.service.ts         ← Wrap SQL từ gis/queries.sql
│   │   │   └── gis.controller.ts      ← /api/gis/*
│   │   └── notifications/
│   │       ├── notifications.module.ts
│   │       └── notifications.service.ts ← eSMS REST API
│   ├── postman/
│   │   └── rescue-api.postman_collection.json
│   ├── .env                           ← KHÔNG commit
│   ├── .env.example                   ← COMMIT cái này
│   └── package.json
│
└── frontend/                          ← Vue 3
    ├── src/
    │   ├── main.ts
    │   ├── App.vue
    │   ├── router/index.ts            ← lazy-loaded routes
    │   ├── stores/
    │   │   ├── auth.store.ts          ← Pinia
    │   │   ├── sos.store.ts
    │   │   └── map.store.ts
    │   ├── views/
    │   │   ├── HomeView.vue           ← SOS button (victim)
    │   │   ├── MapView.vue            ← Theo dõi real-time (victim)
    │   │   ├── DashboardView.vue      ← Bản đồ toàn tỉnh (commander)
    │   │   ├── RescuerView.vue        ← Danh sách nhiệm vụ (rescuer)
    │   │   └── AuthView.vue
    │   ├── components/
    │   │   ├── map/
    │   │   │   ├── RescueMap.vue      ← Leaflet.js component chính
    │   │   │   ├── SosMarker.vue
    │   │   │   └── RescuerMarker.vue
    │   │   └── sos/
    │   │       ├── SosButton.vue      ← Nút đỏ lớn, mobile-first
    │   │       ├── SosTypeSelector.vue
    │   │       └── SosConfirmDialog.vue ← Countdown 5 giây
    │   ├── composables/
    │   │   ├── useSocket.ts           ← Socket.io client + JWT auth
    │   │   ├── useGps.ts              ← navigator.geolocation.watchPosition
    │   │   ├── useSos.ts              ← SOS send/cancel/status
    │   │   └── useMap.ts              ← Leaflet instance
    │   ├── services/
    │   │   ├── api.ts                 ← Axios instance + interceptors
    │   │   ├── auth.service.ts
    │   │   └── sos.service.ts
    │   └── types/
    │       └── index.ts               ← Re-export từ shared/
    └── public/data/
        ├── lamdong-wards.geojson      ← Ranh giới xã/phường (không dùng GADM cũ —
        │                                  đã lỗi thời sau sáp nhập 2025). KHÔNG sửa tay:
        │                                  sinh bằng `npm run build:wards`
        │                                  (frontend/scripts/build-wards-geojson.mjs)
        └── README.md                  ← Nguồn dữ liệu (gis.vn), ghi công, và ghi chú
                                           thiếu Xã Đam Rông 2 (123/124 đơn vị)
```

---

## 6. Database Schema

> ⚠️ **2025-08-24:** Việt Nam sáp nhập hành chính (tỉnh → xã/phường trực tiếp, bỏ
> cấp huyện). Lâm Đồng mới = sáp nhập Lâm Đồng + Đắk Nông + Bình Thuận cũ, 123
> xã/phường/đặc khu. Toàn bộ `district_code` (mã huyện) đã được thay bằng
> `ward_code` (mã xã/phường, `ma_xa`). Xem `gis/01-schema-wards.sql` đến
> `03-migrate-existing-tables.sql`.

### Bảng `wards` (mới)
```sql
ward_code   VARCHAR(10) PRIMARY KEY     -- ma_xa
ward_name   VARCHAR(100) NOT NULL       -- ten_xa
ward_type   VARCHAR(20) NOT NULL        -- 'Phường' | 'Xã' | 'Đặc khu'
merged_from TEXT                        -- các đơn vị cũ đã sáp nhập vào
area_km2    NUMERIC(10,2)
population  INTEGER
boundary    GEOMETRY(MultiPolygon,4326) NOT NULL   -- GiST INDEX bắt buộc
```

### Bảng `users`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
phone VARCHAR(15) UNIQUE NOT NULL
name VARCHAR(100) NOT NULL
password_hash VARCHAR(255) NOT NULL          -- bcrypt cost 12
role VARCHAR(20) CHECK IN ('victim','rescuer','commander')
ward_code VARCHAR(10) REFERENCES wards        -- mã xã/phường
is_active BOOLEAN DEFAULT true
created_at / updated_at TIMESTAMPTZ
```

### Bảng `rescue_teams`
```sql
id UUID PRIMARY KEY
name VARCHAR(100)
leader_id UUID → users.id
ward_code VARCHAR(10) NOT NULL REFERENCES wards
specialties TEXT[]                           -- ['flood','medical','accident']
current_location GEOMETRY(Point,4326)        -- GiST INDEX bắt buộc
status VARCHAR(20) CHECK IN ('available','busy','offline')
```

### Bảng `sos_requests`
```sql
id UUID PRIMARY KEY
victim_id UUID → users.id
location GEOMETRY(Point,4326) NOT NULL       -- GiST INDEX bắt buộc
type VARCHAR(20) CHECK IN (10 loại sự cố)
status VARCHAR(20) CHECK IN (7 trạng thái)  DEFAULT 'pending'
description TEXT
image_url VARCHAR(500)
assigned_team_id UUID → rescue_teams.id
ward_code VARCHAR(10) REFERENCES wards       -- tự suy ra từ location qua trigger
                                              -- (ST_Contains), KHÔNG nhận từ client
false_alarm_count INTEGER DEFAULT 0
cancel_deadline TIMESTAMPTZ                  -- +3 phút từ created_at
created_at / updated_at / resolved_at TIMESTAMPTZ
```

### Bảng `sos_timeline`
```sql
id UUID PRIMARY KEY
sos_id UUID → sos_requests.id ON DELETE CASCADE
actor_id UUID → users.id
action VARCHAR(50)                           -- 'created','assigned','arrived','resolved'
note TEXT
created_at TIMESTAMPTZ
```

---

## 7. API Endpoints

```
POST   /api/auth/register        — Đăng ký (public)
POST   /api/auth/login           — Đăng nhập → JWT (public)
POST   /api/auth/refresh         — Làm mới token (public)
GET    /api/auth/me              — Thông tin user (JWT required)

POST   /api/sos                  — Gửi SOS (role: victim)
GET    /api/sos                  — Danh sách SOS (role: rescuer/commander)
GET    /api/sos/mine/active      — SOS đang hoạt động của tôi (role: victim, khôi phục UI sau F5)
GET    /api/sos/:id              — Chi tiết SOS + timeline (JWT required)
PATCH  /api/sos/:id/cancel       — Victim hủy SOS (role: victim)
PATCH  /api/sos/:id/assign       — Phân công đội (role: commander)
PATCH  /api/sos/:id/status       — Cập nhật tiến độ (role: rescuer)

GET    /api/gis/nearest-teams    — Đội gần nhất PostGIS (role: commander)
GET    /api/gis/sos-heatmap      — Heatmap sự cố (role: commander)

GET    /api/rescue-teams         — Danh sách đội (role: commander)
PATCH  /api/rescue-teams/:id/location — Cập nhật GPS (role: rescuer)
PATCH  /api/rescue-teams/:id/status  — Cập nhật trạng thái (role: rescuer)
```

---

## 8. WebSocket Events

### Server → Client
```typescript
'sos:new'              // Payload: SosNewPayload — SOS mới tạo
'sos:updated'          // Payload: SosUpdatedPayload — Trạng thái SOS đổi
'team:location-updated'// Payload: TeamLocationPayload — GPS đội cứu hộ
'notification:system'  // Payload: SystemNotificationPayload — Cảnh báo
'hazard-report:new'     // Payload: HazardReportNewPayload — báo cáo cộng đồng mới/được gộp (CHỈ room province:lamdong)
'hazard-report:reviewed'// Payload: HazardReportReviewedPayload — commander vừa duyệt/từ chối (CHỈ room province:lamdong)
```

### Client → Server
```typescript
'team:update-location' // Rescuer gửi GPS mỗi 30 giây
'sos:victim-cancel'    // Victim hủy SOS
'commander:assign-team'// Commander phân công
'rescuer:update-status'// Rescuer cập nhật tiến độ
```

### Rooms
```
ward:{ward_code}            — rescuer + commander cùng xã/phường
province:lamdong            — commander toàn tỉnh
sos:{sos_id}                — victim + team được phân công
team:{team_id}               — leader của đội đó (mọi đội leader phụ trách, join lúc connect;
                                xem Mục 15.10 — đội có thể được giao SOS ở xã KHÁC ward của leader,
                                phân công theo khoảng cách GPS chứ không theo ranh giới xã)
```

**⚠️ Import types từ `shared/socket-events.types.ts` — KHÔNG tự định nghĩa lại**

---

## 9. Biến môi trường (`.env`)

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Supabase (Settings → Database → Connection String → URI)
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

# JWT — dùng: openssl rand -base64 32 để tạo
JWT_SECRET=
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

# eSMS.vn (esms.vn → Tài khoản → Thông tin API)
ESMS_API_KEY=
ESMS_SECRET_KEY=
ESMS_SMS_TYPE=2
# SmsType=2 (Brandname CSKH) yêu cầu đăng ký Brandname với bộ phận kinh doanh eSMS
# (0901.888.484) trước khi dùng được — để trống thì API trả lỗi CodeResult=104
# "Brand name code is not exist".
ESMS_BRANDNAME=
RESCUE_CENTER_PHONE=0901234567

# OpenRouteService (openrouteservice.org/dev/#/signup, free tier — Mục 15.13) — để trống thì
# /api/routing/route trả 503, frontend tự lùi về đường chim bay, không ảnh hưởng phần khác.
ORS_API_KEY=
```

**⛔ Không bao giờ commit `.env`. Chỉ commit `.env.example`.**

---

## 10. Business Logic quan trọng

### Luồng SOS
```
1. Victim nhấn SOS → chọn loại → countdown 5s → confirm
2. POST /api/sos với {lat, lng, type}
3. Backend lưu GEOMETRY, đặt cancel_deadline = NOW() + 3 phút
4. GisService.findNearestTeams() → auto-assign team đầu tiên
5. Socket emit 'sos:new' → ward room
6. NotificationsService.sendSosSms() → eSMS (async, không block)
7. Victim có 3 phút hủy miễn phạt (cancel_deadline chưa qua)
8. Rescuer cập nhật: assigned → in_progress → arrived → resolved
```

### Quy tắc cancel
- Hủy TRƯỚC `cancel_deadline` → `status='cancelled'`, `penaltyApplied=false`
- Hủy SAU `cancel_deadline` → `status='cancelled'`, `penaltyApplied=true`
- 3 lần `penaltyApplied=true` → tài khoản bị flag (hiện cảnh báo)

### Rate Limits
- SOS: 5 lần/giờ/user
- Đăng nhập: 5 lần/15 phút/IP
- Đăng ký: 3 lần/giờ/IP

---

## 11. Hướng dẫn cho AI Agent

### Khi nhận yêu cầu, làm theo thứ tự:
1. **Xác định module** — SosModule? AuthModule? GisModule? Frontend view?
2. **Đọc interface** trong `shared/socket-events.types.ts` trước khi sinh type
3. **Entity trước** → DTO → Service → Controller (backend)
4. **Composable trước** → Store → View (frontend)
5. **Kiểm tra `.github/copilot-instructions.md`** — tránh các pattern bị ban

### Nhớ luôn:
- `ST_MakePoint(lng, lat)` — **longitude trước, latitude sau**
- eSMS: `axios.post()` — không dùng SDK, không dùng Twilio
- Vue 3: `<script setup lang="ts">` — không Options API
- NestJS: `class-validator` trong mọi DTO — không `any`
- WebSocket: verify JWT trong `handleConnection()` — disconnect ngay nếu sai

### Prompt mẫu hiệu quả cho AI:

```
"Trong SosModule, thêm endpoint PATCH /api/sos/:id/assign.
Commander phân công team. Cần: JwtAuthGuard + RolesGuard('commander'),
validate teamId là UUID hợp lệ, kiểm tra team đang 'available',
update DB, emit socket 'sos:updated' vào ward room."

"Trong RescueMap.vue, load file /public/data/lamdong-wards.geojson
bằng L.geoJSON(). Style: border xanh #2E75B6, fillOpacity 0.05.
Khi hover: highlight màu đậm hơn. Dùng <script setup lang='ts'>."

"Trong GisService, wrap SQL từ gis/queries.sql (Query 1 — nearest teams).
Params: $1=lng, $2=lat, $3=radius_meters, $4=limit.
Return typed array với interface NearestTeamResult."
```

### Không sinh code cho:
- Docker / docker-compose
- Redis
- Microservices
- React / Next.js (dự án dùng Vue 3)
- Twilio (dùng eSMS)
- MongoDB / Mongoose (dùng PostgreSQL)

---

## 12. Tài khoản demo

```
Victim:    phone=0900000001  password=demo1234  ward=Xuân Hương - Đà Lạt (24781)
Rescuer:   phone=0900000002  password=demo1234  ward=Xuân Hương - Đà Lạt (24781)
Commander: phone=0900000003  password=demo1234  ward=Toàn tỉnh
```

> ⚠️ **Từ 2026-09-06:** `POST /api/auth/register` không còn nhận field `role` (luôn tạo
> `victim` — xem Mục 15, fix lỗ hổng leo thang đặc quyền). 3 tài khoản demo ở trên phải được
> tạo bằng cách chạy `gis/06-seed-demo-users.sql` trên Supabase SQL Editor (SAU
> `01-03`, TRƯỚC `04-create-rescue-teams.sql` vì 04 cần sẵn user `0900000002`) — không còn
> cách nào tạo qua API public nữa.

---

## 13. Lệnh thường dùng

```bash
# Backend
cd backend
npm run start:dev          # Dev với hot reload
npm run build              # Build production
npm run start:prod         # Chạy production build

# Frontend
cd frontend
npm run dev                # Dev server (localhost:5173)
npm run build              # Build production

# Database (Supabase SQL Editor)
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();

# Cài AI Skills
npx skills add Kadajett/agent-nestjs-skills
npx skills add j4flmao/agent_skills_nodejs_nestjs

# Tạo JWT Secret ngẫu nhiên
openssl rand -base64 32
```

---

## 14. AI Skills — Bảng tóm tắt

| Skill | Nguồn | Áp dụng cho | Khi nào dùng |
|---|---|---|---|
| `nestjs-best-practices` | Kadajett/agent-nestjs-skills | Backend | Mọi lúc khi code NestJS |
| `nestjs-oop-clean-arch` | j4flmao/agent_skills_nodejs_nestjs | Backend | Thiết kế module, kiến trúc |
| NestJS Anti-Hallucination | PatrickJS/awesome-cursorrules | Backend | Đã tích hợp vào .github/copilot-instructions.md |
| Vue 3 Composition API | PatrickJS/awesome-cursorrules | Frontend | Đã tích hợp vào .github/copilot-instructions.md |
| `owasp-security` | BehiSecc/awesome-claude-skills | Bảo mật | Code review, security check |
| `webapp-testing` | Anthropic official | Testing | Viết test Playwright |
| `varlock-claude-skill` | BehiSecc/awesome-claude-skills | Secrets | Kiểm tra trước commit |
| `systematic-debugging` | Cộng đồng | Debug | Khi PostGIS query sai |

---

## 15. Checklist audit — lỗ hổng quan trọng chưa xử lý (2026-09-05)

> Phát hiện khi đối chiếu TỪNG DÒNG tài liệu này với code thật (chạy lệnh thật, không chỉ đọc). Đánh dấu `[x]` khi đã xử lý — **đừng xoá dòng đã xong**, để giữ lịch sử audit. Agent nào tình cờ đọc tới Mục này: kiểm tra lại bằng lệnh nêu kèm trước khi tin dòng nào đã cũ.

### 15.1 Bảo mật — chặn merge nếu chưa xong
- [x] **Rate limit chưa hề tồn tại.** — **Đã xử lý (2026-09-06).** Cài `@nestjs/throttler`, đăng ký `ThrottlerModule.forRoot([{ name: 'default', ttl: minutes(1), limit: 100 }])` làm baseline chống DoS cho mọi route (`backend/src/app.module.ts`). 3 route nhạy cảm override số cụ thể bằng `@Throttle({ default: { limit, ttl } })`: `POST /api/auth/login` (5/15 phút), `POST /api/auth/register` (3/giờ), `POST /api/sos` (5/giờ). Guard toàn cục là `UserThrottlerGuard` (`backend/src/common/guards/user-throttler.guard.ts`) — throttle theo **user.id** khi có Bearer token hợp lệ (bucket theo `/user` đúng như yêu cầu, không bị NAT/wifi chung IP đánh lừa), fallback về IP cho route công khai (login/register). Lưu ý kỹ thuật: guard này là `APP_GUARD` nên chạy TRƯỚC `JwtAuthGuard` cấp controller — `req.user` chưa được Passport gán lúc guard chạy, nên phải tự `jsonwebtoken.decode()` (không verify chữ ký, chỉ để bucket đúng user) lấy `sub` từ header thay vì đọc `req.user`. Đã build + `npm test` pass + boot thật (`node dist/main.js`) xác nhận `ThrottlerModule` init không lỗi trước khi tới bước kết nối DB.
- [x] **`.cursorrules` được viết đầy đủ ở Mục 4 nhưng KHÔNG tồn tại ở project root** — **Đã xử lý (2026-09-06), nhưng đổi vị trí file:** team dùng **VS Code**, không dùng Cursor IDE, nên `.cursorrules` (Cursor-only) không phải nơi phù hợp. Nội dung Mục 4 đã được chép ra `.github/copilot-instructions.md` — đây là file custom instructions mà VS Code (GitHub Copilot Chat) tự động đọc cho mọi request trong workspace. Nếu sau này có ai dùng Cursor IDE, copy cùng nội dung ra `.cursorrules` ở project root (Cursor không đọc `.github/copilot-instructions.md`).
- [x] **Quy tắc "3 lần huỷ trễ → tài khoản bị flag" (Mục 10) chưa implement.** — **Đã xử lý (2026-09-06).** Thêm cột `users.late_cancel_count` (INTEGER) và `users.is_flagged` (BOOLEAN) qua `gis/05-add-account-flag.sql` (⚠️ **cần tự chạy file này trên Supabase SQL Editor** — agent không tự chạy migration lên DB thật). `SosService.cancel()`: khi `penaltyApplied=true` → tăng `sos_requests.false_alarm_count` của chính request đó +1, VÀ tăng `users.late_cancel_count` +1, tự set `is_flagged=true` khi đạt ngưỡng 3 (xem `LATE_CANCEL_FLAG_THRESHOLD` trong `sos.service.ts`). **Quyết định có chủ đích: KHÔNG chặn** victim gửi SOS/đăng nhập khi đã bị flag — đây là app cứu hộ khẩn cấp, chặn tín hiệu SOS thật vì lịch sử huỷ trễ rủi ro hơn nhiều so với vài lần báo giả. Flag chỉ hiện cảnh báo: `PATCH /api/sos/:id/cancel` trả `accountFlagged` + message cảnh báo riêng, và `isFlagged`/`lateCancelCount` có sẵn trong `GET /api/auth/me` (vì `JwtStrategy.validate()` load full `User` entity) để frontend tự hiển thị banner cảnh báo cho victim/commander.
- [x] **`.env` không được validate lúc khởi động.** — **Đã xử lý (2026-09-06).** Thêm `backend/src/config/env.validation.ts` (Joi schema) + `validationSchema` vào `ConfigModule.forRoot()` (`app.module.ts`). Bắt buộc: `DATABASE_URL` (đúng định dạng URI `postgres(ql)://`), `JWT_SECRET`, `JWT_REFRESH_SECRET` (tối thiểu 16 ký tự) — thiếu hoặc sai định dạng → **crash ngay lúc boot** với message rõ biến nào sai, không đợi tới request đầu tiên. ESMS_* để optional (SMS chỉ là kênh dự phòng, không được chặn boot cả server). **Đã kiểm chứng thật:** chạy `node dist/main.js` với `DATABASE_URL` thật trong `.env` phát hiện luôn một bug có sẵn — connection string có ký tự `@` chưa được percent-encode trong password, phá cấu trúc URI (`ConfigModule.forRoot` báo lỗi ngay, không phải lỗi PostGIS/TypeORM mơ hồ như trước). **Cần xử lý:** tự sửa lại `DATABASE_URL` trong `backend/.env` (không commit) — encode `@` trong password thành `%40`, hoặc kiểm tra lại có bị dính thừa một đoạn `@...` không mong muốn khi copy từ Supabase.

### 15.2 Rule đã viết ra nhưng không được máy enforce
- [x] **`backend/eslint.config.mjs` tắt thẳng đúng rule CLAUDE.md cấm:** dòng `'@typescript-eslint/no-explicit-any': 'off'` mâu thuẫn trực tiếp với Mục 4 ("NEVER use 'any'"). — **Đã xử lý (2026-09-06).** Xoá override `no-explicit-any: 'off'` cùng 2 override khác đang hạ xuống `'warn'` (`no-floating-promises`, `no-unsafe-argument`) — cả 3 rule giờ chạy đúng mức mặc định `'error'` của `tseslint.configs.recommendedTypeChecked`, thêm 1 override hợp lệ: `no-unused-vars` với `argsIgnorePattern`/`varsIgnorePattern: '^_'` (quy ước biến bỏ qua có chủ đích, không phải nới lỏng rule bị cấm). Sửa 8 lỗi lint thật hiện ra: `jwt.strategy.ts` (`payload: any` → interface `JwtPayload` mới ở `backend/src/auth/jwt-payload.interface.ts`, dùng lại được cho các chỗ khác cần decode JWT); `auth.controller.ts` (`getMe(@Request() req: any)` → type `AuthenticatedRequest = ExpressRequest & { user: User }`, bỏ `async` thừa vì không có `await` nào trong thân hàm); `auth.controller.ts` + `auth.service.ts` (biến `passwordHash` destructure ra rồi không dùng → đổi tên `_passwordHash` theo quy ước ignore-pattern mới thêm); `main.ts` (`bootstrap()` thiếu `.catch()` → thêm `.catch(err => { console.error(...); process.exit(1); })`); `common/guards/user-throttler.guard.ts` (`getTracker(req: Record<string, any>)` → thu hẹp kiểu tham số về `TrackableRequest` có sẵn trong file, TypeScript cho phép nhờ bivariant method param checking). Đã kiểm chứng: `npm run lint` (0 lỗi), `npm test`, `npm run build` đều sạch sau khi sửa.
- [x] **Frontend không có ESLint** (không file cấu hình, không devDependency nào). — **Đã xử lý (2026-09-06).** Cài `eslint`, `@eslint/js`, `typescript-eslint`, `globals` (khớp version với `backend/package.json` để 2 workspace không lệch major) + `eslint-plugin-vue`. Thêm `frontend/eslint.config.js` (flat config): `eslint.configs.recommended` + `tseslint.configs.recommended` + `pluginVue.configs['flat/essential']`, override `no-explicit-any: 'error'` (Mục 4), `vue/component-api-style: [['script-setup']]` (chặn Options API — enforce máy, không chỉ văn bản), `vue/block-lang: { script: { lang: 'ts' } }` (chặn `<script>` thiếu `lang="ts"`). Thêm script `"lint": "eslint \"src/**/*.{ts,vue}\" --fix"` vào `frontend/package.json`. **Sự cố giữa chừng đã tự phát hiện và sửa:** lần thử đầu dùng `pluginVue.configs['flat/recommended']` (bao gồm cả lớp rule "strongly-recommended" thuần định dạng — xuống dòng attribute, tự thêm self-closing...). Chạy `--fix` trên toàn bộ `src/` đã viết đè hơn chục file `.vue` bằng định dạng khác hẳn, kể cả những file đang có sửa dở dang chưa commit từ trước (không phải do phiên này gây ra) — rất suýt làm loãng diff thật của người dùng vào một đống format lại vô nghĩa. Đã phát hiện qua `git status` (nhiều file hiện `M` hơn hẳn danh sách ban đầu), đối chiếu bằng `git diff -w` để tách phần nội dung thật khỏi phần thuần xuống dòng, viết tay lại đúng phần nội dung thật theo style một dòng cũ của file, sau đó **đổi sang `flat/essential`** (chỉ rule bắt lỗi thật, không có rule định dạng) — dự án frontend chưa có Prettier nên không nên để một plugin lint tự áp phong cách riêng lên toàn bộ code cũ. Đã xác nhận lại: `npx eslint` (không `--fix`, đúng như CI chạy) và `npm run lint` (có `--fix`, dùng khi dev) đều không còn đổi file nào ngoài ý muốn. **Kết quả kiểm chứng:** codebase hiện tại sạch 100% theo `flat/essential` + các rule Mục 4 — đã test bằng 1 file `.vue` tạm chèn `const x: any = 1` → ESLint bắt đúng lỗi `no-explicit-any`, rồi xoá file tạm, để chắc chắn rule thật sự chạy chứ không phải config no-op im lặng. Đã chạy lại `npm ci` sạch (xoá `node_modules`) + lint + `npm test` + `npm run build` để xác nhận không có dependency nào xung đột.
- [x] **Không có CI** (`.github/workflows/` không tồn tại ở project). — **Đã xử lý (2026-09-06).** Thêm `.github/workflows/ci.yml`: 2 job song song `backend` và `frontend` (mỗi job: `actions/checkout` → `actions/setup-node@v4` Node 20 kèm cache npm theo đúng `package-lock.json` của từng workspace → `npm ci` → eslint → `npm test` → `npm run build`), trigger trên `push`/`pull_request` nhắm nhánh `main`. **Lưu ý kỹ thuật có chủ đích:** CI gọi thẳng `npx eslint ...` (không dùng script `"lint"` có sẵn `--fix`) — CI phải BÁO ĐỎ khi có lỗi lint chưa sửa, không được tự `--fix` rồi báo xanh giả. Đã mô phỏng đúng từng bước CI cục bộ cho cả 2 workspace (`rm -rf node_modules && npm ci` rồi chạy đúng lệnh lint/test/build không `--fix`) — tất cả pass sạch trước khi tin file workflow này đúng.
- [x] **Backend chỉ có 1 file test mặc định do Nest scaffold sinh ra** — 0 test cho `SosService`, `RolesGuard`, `AuthService`. — **Đã xử lý (2026-09-06)**, chỉ phần backend. Thêm 3 file test dùng **hand-rolled fakes** (tự tạo object giả implement đúng phần interface được gọi, ép kiểu qua `as unknown as X` — không dùng `Test.createTestingModule` vì cả 3 class chỉ cần constructor injection thuần, không cần DI container thật): `auth/auth.service.spec.ts` (register trả token + user không lộ `passwordHash`; login đúng/sai mật khẩu/không tồn tại/tài khoản bị khoá — mock `bcrypt.compare` qua `jest.mock('bcrypt')`); `auth/guards/roles.guard.spec.ts` (route không yêu cầu role nào → luôn qua; role hợp lệ → qua; role sai hoặc thiếu `request.user` → `ForbiddenException`); `sos/sos.service.spec.ts` — trọng tâm là **state machine trạng thái SOS**: `cancel()` (không tìm thấy/không phải chủ SOS/SOS đã kết thúc/huỷ trước hạn không phạt/huỷ sau hạn tăng `late_cancel_count` và có thể set `is_flagged`), `assign()` (SOS không tồn tại/không ở trạng thái `pending`/đội không tồn tại/đội không `available`/thành công kèm emit socket đúng ward), `updateStatus()` (SOS không tồn tại/chưa được phân công đội/rescuer không phải leader của đội/chuyển trạng thái nhảy bước bị chặn/`assigned→in_progress` hợp lệ không giải phóng đội/`arrived→resolved` hợp lệ có giải phóng đội về `available`). Tổng 26 test, tất cả pass ngay từ lần chạy đầu (`npm test`), không phải sửa lại implementation. **Còn nợ, CHƯA xử lý:** phần frontend nêu trong dòng gốc — `RescuerView`/`DashboardView`/`useLeafletMap` vẫn chưa có test, giữ nguyên hiện trạng.

### 15.3 Tài liệu lệch code thực tế
- [ ] **Mục 7 liệt kê `POST /api/auth/refresh` như route đã có** — thực tế **chưa implement** (`auth.controller.ts` không có route này; `docs/api-contract.md` ghi rõ và dặn **đừng** code silent-refresh). Nên sửa Mục 7 thành `POST /api/auth/refresh — ⚠️ CHƯA CÓ, xem docs/api-contract.md` để agent sau này khỏi tưởng đã tồn tại mà gọi vào.
- [ ] **Mục 5 (cấu trúc thư mục frontend) không khớp thực tế đã triển khai** — ví dụ dự án dùng `stores/mapData.ts`/`toast.ts`/`offlineQueue.ts`/`auth.store.ts` thay vì `sos.store.ts`/`map.store.ts`; không có `AuthView.vue` (dùng `AuthModal.vue` dạng modal); `SosTypeSelector.vue`/`SosMarker.vue`/`RescuerMarker.vue` không tồn tại làm file riêng (logic đã gộp vào nơi khác). Nếu team chấp nhận hướng đi thực tế, cập nhật lại Mục 5 — giữ bản cũ sẽ khiến agent liên tục cố tạo file trùng chức năng.
- [ ] **`gis/queries.sql` (nhắc ở Mục 2 và Mục 5) không tồn tại** — file thật là `gis/04-create-rescue-teams.sql`. Cập nhật lại đường dẫn trong tài liệu hoặc tạo đúng file `queries.sql` như mô tả.

### 15.4 Bug thật đã sửa — lệch giữa rule Mục 4 và hành vi mong muốn
- [x] **Đăng nhập xong reload trang (F5) là bị đăng xuất ngay lập tức.** — **Đã xử lý (2026-09-06).** Nguyên nhân: `frontend/src/stores/auth.store.ts` trước đó chỉ giữ `accessToken`/`refreshToken`/`user` trong biến Pinia ở RAM — comment cũ trong file còn ghi rõ chủ đích "mất khi tải lại trang", vì Mục 4 (VUE 3 RULES → BANNED) cấm `any localStorage usage (not supported in artifacts)`. Rule đó copy nguyên từ cursorrules template cho ngữ cảnh Claude Artifacts (sandbox không có `localStorage`) — **không áp dụng cho web app thật deploy Vercel/Render này**, áp y nguyên gây ra đúng bug trên. **Hướng "đúng chuẩn" lâu dài** (chưa làm, xem ghi chú dưới) là refreshToken nằm trong cookie `httpOnly + Secure + SameSite` + endpoint `POST /api/auth/refresh` thật ở BE (JS không đụng vào refreshToken được → an toàn hơn trước XSS) — nhưng route đó hiện **không tồn tại** và `docs/api-contract.md` Mục 1 dặn rõ đừng code silent-refresh, nên chưa đủ điều kiện làm ngay. **Fix tạm đã áp dụng:** lưu phiên vào `sessionStorage` (không phải `localStorage` — tự xoá khi đóng tab/trình duyệt, giảm thời gian sống token nếu dính XSS so với localStorage) trong `auth.store.ts`, khôi phục đồng bộ lúc store khởi tạo (nên `router.beforeEach` ở `router/index.ts` thấy đúng `isLoggedIn` ngay từ lần điều hướng đầu), và gọi `useAuthStore().fetchMe()` một lần ở `main.ts` lúc boot để xác thực lại token khôi phục — token hết hạn/sai sẽ bị interceptor 401 có sẵn trong `services/http.ts` tự `logout()` sạch, không cần thêm logic riêng. Đã kiểm chứng: `vue-tsc --noEmit`, `eslint`, `npm run build` đều sạch. **Còn nợ nếu có thời gian:** nâng cấp lên cookie httpOnly + `/api/auth/refresh` thật thay vì sessionStorage — cần sửa `auth.controller.ts`/`auth.service.ts` (set cookie), `main.ts` BE (`cookie-parser`, `CORS credentials:true`), và cập nhật lại đoạn cấm silent-refresh trong `docs/api-contract.md`.
- [ ] **Mục 4 (VUE 3 RULES → BANNED) vẫn còn ghi `any localStorage usage (not supported in artifacts)` y nguyên** — dòng audit trên đã giải thích rule này sai ngữ cảnh, nhưng bản thân Mục 4 chưa được sửa lại. Nếu team đồng ý sessionStorage/localStorage được phép dùng có chọn lọc cho việc lưu phiên đăng nhập (không phải PII khác), nên sửa lại rule ở Mục 4 thành dạng rõ ràng hơn (VD: "không lưu password/PII vào Web Storage; token phiên đăng nhập được phép dùng sessionStorage") thay vì cấm tuyệt đối — giữ nguyên như cũ sẽ khiến agent sau này đọc Mục 4 rồi tưởng nhầm `auth.store.ts` đang vi phạm rule.
- [x] **Marker/thẻ theo dõi SOS của victim biến mất sau F5 dù bản ghi vẫn còn nguyên trong `sos_requests`.** — **Đã xử lý (2026-09-06).** Cùng họ bug với 2 dòng audit trên (state chỉ sống trong RAM), nhưng nặng hơn: `useSos.ts` → `activeSos` mất sau F5 là do thiếu API để hỏi lại, không chỉ thiếu chỗ lưu — `GET /api/sos` chặn role `victim` (`403`, xem `docs/api-contract.md` Mục 2), còn `GET /api/sos/:id` cần biết trước `id`, đúng cái bị mất lúc reload. Nên phải sửa **cả BE lẫn FE**: (1) BE thêm `GET /api/sos/mine/active` (role `victim`) ở `sos.controller.ts`/`sos.service.ts` — trả SOS chưa kết thúc (`status NOT IN ('resolved','cancelled','false_alarm')`) mới nhất của chính victim gọi, kèm timeline, cùng shape `GET /api/sos/:id` (2 route dùng chung `SOS_DETAIL_SELECT` + `attachTimeline()` để khỏi lặp SQL). Route đặt **trước** `@Get(':id')` trong controller cho an toàn dù về mặt kỹ thuật path 2 đoạn `mine/active` không khớp pattern `:id` 1 đoạn nên thứ tự khai báo không bắt buộc ở đây. **Cố ý phá 1 quy ước chung:** endpoint này trả `data: null` khi không có SOS active — khác quy ước "data không bao giờ null khi success:true" ở `docs/api-contract.md` Mục 0 — vì đây là kết quả hợp lệ (giống "get current cart" rỗng), ép về `404` sẽ khiến interceptor `http.ts` phía FE hiện toast lỗi cho một trạng thái bình thường; đã ghi rõ ngoại lệ này vào `docs/api-contract.md`. (2) FE: `sosService.ts` thêm `xemSosDangHoatDongCuaToi()`, `useSos.ts` thêm `khoiPhucSosDangHoatDong()` (bỏ qua nếu đã có `activeSos` để không ghi đè state mới hơn trong cùng phiên), gọi từ `MapView.vue` `onMounted` — chỉ khi `laVictim` — **trước** đoạn áp lại marker sẵn có, để marker vẽ đúng ngay từ đầu. Đã kiểm chứng: BE thêm 2 test cho `findMyActive` (`sos.service.spec.ts`, tổng 28 test pass), `npm run build`/`eslint` BE sạch; FE `vue-tsc --noEmit`/`eslint`/`npm run build` sạch. **Case 2 (thẻ theo dõi cho SOS queued offline) — Đã xử lý (2026-09-06).** `stores/offlineQueue.ts` thêm `laySosDangChoGuiGanNhat()` (đọc IndexedDB, trả item mới nhất theo `taoLuc`); `MapView.vue onMounted` gọi hàm này ngay sau `khoiPhucSosDangHoatDong()` — CHỈ khi server báo không có SOS active nào (`!sos.activeSos.value`), tránh ghi đè nếu SOS đã thật sự tồn tại trên server. Sửa kèm 1 bug đúng lúc động vào: `useSos.ts` → `datSosChoGui()` trước đó luôn tính `cancelDeadline = now + 3 phút` bất kể gọi lúc nào — nếu dùng để KHÔI PHỤC (không phải lần lưu đầu), gọi lại sau khi đã trôi qua vài phút sẽ vô tình cấp thêm 3 phút miễn phạt mới, sai với hạn huỷ thật tính từ lúc gửi ban đầu. Thêm tham số `taoLuc` optional (mặc định `now` — giữ nguyên hành vi ở lần gọi gốc trong `MapView.vue xacNhanGuiSos`), khi khôi phục truyền đúng `taoLuc` gốc từ `QueuedSos` (đã có sẵn field này). Đã kiểm chứng: thêm 2 test (`useSos.spec.ts` — tổng 10 test FE pass), `vue-tsc --noEmit`/`eslint`/`npm run build` sạch.

**Bug liên quan phát hiện thêm lúc sửa Case 2 — Đã xử lý (2026-09-06).** `offlineQueueStore.khoiTao()` trước đây chỉ tự gửi hàng đợi khi bắt được sự kiện DOM `'online'` — nếu victim đóng hẳn tab lúc mất mạng rồi mở lại app khi ĐÃ có mạng sẵn (không có pha chuyển offline→online nào xảy ra trong phiên mới), hàng đợi im lặng nằm yên trong IndexedDB vô thời hạn tới lần mất-rồi-có-mạng kế tiếp. Đã tách phần xử lý ra hàm `guiLaiHangDoiNeuCoMang()` dùng chung cho cả 2 chỗ, và gọi ngay 1 lần lúc `khoiTao()` chạy nếu `navigator.onLine` đã `true` sẵn — không chỉ đăng ký chờ event nữa. `xuLyHangDoiKhiCoMang()`/`xuLyHangDoiSosKhiCoMang()` đã tự return sớm nếu hàng đợi rỗng nên gọi thừa lúc không có gì để gửi vô hại. Đã kiểm chứng: `vue-tsc --noEmit`/`eslint`/`npm run build`/`npm test` (10 test FE) đều sạch.

### 15.4.1 Bug thật đã sửa — toast trùng/sai khi đăng nhập bị rate-limit
- [x] **Bị chặn 429 (too many requests) lúc đăng nhập nhưng vẫn hiện thêm toast "Sai số điện thoại hoặc mật khẩu".** — **Đã xử lý (2026-09-06).** `AuthModal.vue dangNhap()` có `catch` bắt MỌI lỗi rồi luôn hiện cứng 1 câu "Sai số điện thoại hoặc mật khẩu" bất kể lỗi thật là gì — trong khi interceptor toàn cục `http.ts` đã tự hiện đúng toast theo status thật (401 sai mật khẩu, 429 rate-limit, mất mạng...) rồi. Vì `toastStore` xếp hàng đợi (không đè lên nhau, cố ý để không mất toast khi dồn dập — xem `stores/toast.ts`), user thấy CẢ 2 toast nối tiếp: toast đúng (429) rồi tới toast sai/thừa (401 giả). **Fix:** không phải thêm `if (status === 401)` vào component (dạy component đọc HTTP status là band-aid, lặp lại kiến thức đã có sẵn ở `http.ts`) — mà xoá hẳn toast cứng đó, để `catch {}` rỗng kèm comment, đúng quy ước ĐÃ CÓ SẴN ở mọi nơi khác gọi API trong codebase (`RescuerView.vue`, `DashboardView.vue`, `MapView.vue`, `stores/mapData.ts` đều dùng pattern này). `AuthModal.vue` là chỗ DUY NHẤT lệch quy ước, giờ đã khớp lại. Đã kiểm chứng: `eslint`, `npm run build` sạch.

### 15.5 Vận hành
- [x] **Chưa có health-check endpoint** (`GET /api/health`). — **Đã xử lý (2026-10-05)**, xem Mục 15.15. Deploy lên Render.com (Mục 2) mà thiếu endpoint này thì platform không có cách xác định server còn sống hay đã treo để tự restart.
- [ ] **`frontend/.env` bị root `.gitignore` (`**/.env`) chặn**, trong khi comment ở `frontend/.gitignore` khẳng định ngược lại ("không phải secret, commit để cả nhóm dùng chung cấu hình chuẩn"). Hai file `.gitignore` đang mâu thuẫn — cần thêm exception `!frontend/.env` ở root hoặc sửa lại comment sai.
- [ ] **Trước khi coi một phiên làm việc là "xong": luôn chạy `git status` ở cả `backend/` và `frontend/`.** Từng xảy ra thật: toàn bộ `frontend/` chưa commit lần nào dù đã có nhiều tính năng hoàn chỉnh — dễ mất việc nếu máy hỏng/branch bị xoá nhầm.

### 15.6 Audit senior 2026-09-06 — bảo mật + an toàn nghiệp vụ (rà độc lập với 15.1-15.5)

> Rà theo góc nhìn "senior review", không chỉ đối chiếu tài liệu-code như các mục trên — tìm lỗ hổng bảo mật thật (khai thác được) và lỗi an toàn nghiệp vụ (ảnh hưởng trực tiếp tới việc điều phối cứu hộ thật), không phải chỉ style/lint.

**P0 — nghiêm trọng, đã xử lý:**
- [x] **Leo thang đặc quyền qua `POST /api/auth/register`.** — **Đã xử lý (2026-09-06).** Trước đây `RegisterDto.role` cho client tự chọn `victim|rescuer|commander` tự do — ai gọi thẳng API (không qua UI, frontend luôn hardcode `role:'victim'`) cũng tự phong mình làm `commander` được, xem toàn bộ PII nạn nhân (tên/SĐT/GPS) toàn tỉnh + tự `PATCH /assign` phân công đội cho SOS thật; tự phong `rescuer` nhẹ hơn (không điều khiển được `rescue_teams` thật vì `leader_id` cố định từ SQL seed) nhưng vẫn đọc được PII nạn nhân trong `wardCode` tự khai. Đúng loại OWASP #1 Broken Access Control. **Fix:** xoá hẳn field `role` khỏi `RegisterDto` (`auth/dto/register.dto.ts`) — nhờ `forbidNonWhitelisted: true` sẵn có ở `main.ts`, gửi kèm `role` trong body giờ bị từ chối thẳng `400` thay vì âm thầm bỏ qua; `UsersService.create()` ép cứng `role: 'victim'` không đọc từ DTO nữa. **Hệ quả cần xử lý:** 3 tài khoản demo (Mục 12) trước đây được tạo bằng chính đường register-với-role-tự-do này — giờ route đó chỉ tạo được `victim`, nên thêm `gis/06-seed-demo-users.sql` (INSERT trực tiếp `users` với password đã bcrypt cost=12 sẵn, verify bằng `compareSync` trước khi ghi vào file) để thay thế bước đó — **cần tự chạy** trên Supabase SQL Editor (agent không tự chạy migration lên DB thật), chạy TRƯỚC `04-create-rescue-teams.sql` (04 cần sẵn user `0900000002`). Đã kiểm chứng: thêm `users/users.service.spec.ts` (test "leo thang" bằng payload cast tay có `role:'commander'` → vẫn ra `victim`), tổng 33 test BE pass, `npm run build`/`eslint` sạch.
- [x] **GPS lỗi/bị từ chối quyền → âm thầm gửi toạ độ giả (tâm tỉnh) mà không báo ai.** — **Đã xử lý (2026-09-06).** `MapView.vue layViTriHienTai()` trước đây fallback về `{lat:11.94,lng:108.44}` khi `navigator.geolocation` lỗi/timeout/bị từ chối, trong khi dialog xác nhận vẫn khẳng định "vị trí hiện tại của bạn sẽ được gửi" (`SosConfirmDialog.vue`) — nạn nhân, rescuer, commander không ai biết vị trí đã gửi là bịa, đội có thể bị điều tới sai chỗ giữa 1 tình huống khẩn cấp thật. **Fix xuyên suốt cả 2 tầng:** (1) FE: `layViTriHienTai()` trả thêm cờ `uocLuong: boolean`; khi `true`, hiện toast cảnh báo victim NGAY trước khi gửi ("không xác định được vị trí GPS chính xác..."); cờ này (đổi tên `locationEstimated` khi qua API) được truyền xuyên suốt: `useSos.ts` (`ActiveSos.locationEstimated`, `guiYeuCauSos`/`datSosChoGui`/`ghiNhanKetQuaThatTuHangDoi`/`khoiPhucSosDangHoatDong`), `types/offline.ts` (`QueuedSos.locationEstimated` — giữ nguyên qua hàng đợi offline nếu vừa mất mạng vừa mất GPS), hiện badge cảnh báo "⚠️ Vị trí ước tính" ở `SosTrackerPanel.vue` (cho victim), `RescuerView.vue` + `DashboardView.vue` (cho rescuer/commander, kể cả trong modal phân công đội — nơi quan trọng nhất vì đội gần nhất được tính theo đúng toạ độ có thể sai này). (2) BE: cột mới `sos_requests.location_estimated BOOLEAN DEFAULT false` (`gis/07-add-location-estimated.sql`, **cần tự chạy** trên Supabase), `CreateSosDto.locationEstimated` optional (mặc định `false` nếu client cũ không gửi), lan qua `SosService.create()`/`findAll()`/`SOS_DETAIL_SELECT` (dùng chung cho `findById`/`findMyActive`), và `SosNewPayload` (cả 2 file mirror `backend/src/common/socket-events.types.ts` + `frontend/src/shared/socket-events.types.ts` — PHẢI sửa đồng bộ cả 2, xem comment đầu file mirror). Đã kiểm chứng: thêm test cho `SosService.create()` (2 case: có/không `locationEstimated`) + test `useSos.ts` (lưu đúng cờ khi gửi thật lẫn khi khôi phục từ hàng đợi offline) — 33 test BE + 11 test FE pass, build/lint cả 2 sạch.

**P1 — cao, đã xử lý:**
- [x] **"Tự động phân công đội gần nhất" ở Mục 10 bước 4 chưa từng được code.** — **Đã xử lý (2026-09-06).** Chọn hướng (a): code auto-assign thật thay vì sửa docs, vì hạ tầng `GisService.findNearestTeams()` đã có sẵn và đây đúng là hành vi mong muốn cho app cứu hộ (giảm phụ thuộc vào có người trực dashboard). `SosService.create()` giờ gọi `findNearestTeams(lat, lng, 10000, 1)` ngay sau INSERT — có đội `available` trong 10km thì tự UPDATE `sos_requests.status='assigned'` + `rescue_teams.status='busy'` + ghi `sos_timeline` (action `'assigned'`, `actor_id`=victim vì bảng không có khái niệm actor "hệ thống", `note` phân biệt rõ là tự động) + emit thêm `sos:updated` (ngoài `sos:new` như cũ) để rescuer đội đó nhận nhiệm vụ qua đúng listener `onSosUpdated` đã có sẵn ở `RescuerView.vue` — **không cần sửa gì ở frontend**. Không tìm thấy đội nào → giữ nguyên `'pending'`, luồng phân công tay qua `PATCH /:id/assign` không đổi. Cần `GisModule` export `GisService` + `SosModule` import `GisModule` (không có vòng phụ thuộc — đã boot thật `node dist/main.js` xác nhận DI graph resolve sạch, route `/api/sos/mine/active` vẫn map đúng trước `:id`). Đã kiểm chứng: thêm 2 test (`sos.service.spec.ts` — có đội/không có đội), tổng 35 test BE pass, `npm run build`/`eslint` sạch, `docs/api-contract.md` Mục 2 cập nhật mô tả hành vi mới.
- [x] **`docs/api-contract.md` Mục 6 vẫn ghi "`false_alarm_count`/auto-flag CHƯA cập nhật" và "rate limit CHƯA implement"** — **Đã xử lý (2026-09-06).** Cả 2 dòng đều lỗi thời (đã làm xong từ trước, xem Mục 15.1) — xoá khỏi Mục 6, thêm dòng "đã sửa khỏi danh sách" liệt kê rõ 3 việc từng ghi nhầm là chưa làm (rate limit, false_alarm_count/auto-flag, và giờ thêm auto-assign). Tiện thể sửa luôn ví dụ response `PATCH /:id/cancel` ở Mục 2 (thiếu field `accountFlagged` trong JSON mẫu — response thật đã trả từ 2026-09-06).

**P2 — trung bình, CHƯA xử lý (biết để không mất thời gian sau này):**
- [ ] **Mục 8 liệt kê 3 socket event client→server (`sos:victim-cancel`, `commander:assign-team`, `rescuer:update-status`) không tồn tại trong `sos.gateway.ts`** — chỉ có `team:update-location` là thật, 3 việc kia frontend đúng khi dùng REST thay thế. Tài liệu vẽ ra mô hình chưa từng được xây, agent sau đọc Mục 8 dễ tưởng lầm.
- [ ] **`GET /api/gis/sos-heatmap` có sẵn ở BE + khai báo URL ở FE (`config.ts`) nhưng không nơi nào gọi** — `DashboardView.vue` chưa có heatmap. Kể cả nối dây xong, SQL `GROUP BY location` (toạ độ tuyệt đối) thay vì gom theo vùng/ward khiến `incident_count` gần như luôn = 1 (GPS hiếm khi trùng y hệt) — cần sửa cách gom nhóm trước khi tính năng này có ý nghĩa.
- [ ] **`CreateSosDto.imageUrl` chỉ `@IsString()`, không `@IsUrl()`** — chấp nhận cả chuỗi `javascript:...`. Chưa ai render field này ra `<a>`/`<img>` nên chưa khai thác được, nhưng nên siết trước khi có UI "xem ảnh" cho rescuer/commander.
- [x] **`accountFlagged` backend trả từ lâu nhưng frontend bỏ qua hoàn toàn.** — **Đã xử lý (2026-09-06).** `types/index.ts` → `CancelSosResult` thêm field `accountFlagged: boolean`; `MapView.vue xacNhanHuySos()` hiện thêm 1 toast cảnh báo riêng khi `result.accountFlagged === true` (tận dụng `toastStore` đã có hàng đợi từ trước — gọi `showToast()` 2 lần liên tiếp không mất toast nào). `useSos.ts huyYeuCauSos()` không cần sửa vì đã trả nguyên `result` từ server, không transform field nào — `accountFlagged` tự lan qua sẵn. Đã kiểm chứng: `vue-tsc --noEmit`/`eslint`/`npm run build`/`npm test` (11 test FE) đều sạch.

### 15.7 Audit 2026-09-08 — bản đồ trắng khi zoom (phần tile: CHƯA sửa)

> Triệu chứng người dùng báo: *"mỗi khi zoom map để xem chi tiết đều bị nền trắng che mất"*. Điều tra bằng Chrome headless + CDP trên `/map` (đo thật, không đọc code suy đoán).
>
> ⚠️ **ĐỌC KÈM MỤC 15.8.** Sau khi viết mục này, người dùng làm rõ triệu chứng thật của họ là **"vỡ hình + lag khi zoom in, zoom out hết cỡ mới hết"** — một bug KHÁC, nguyên nhân khác, **đã sửa xong ở Mục 15.8**. Phần tile/service worker ghi dưới đây vẫn **chưa sửa** và vẫn đúng: nó là một lỗ hổng thật, chỉ là không phải cái người dùng đang gặp.

**Vùng "trắng" đó là gì:** nền của chính bản đồ lộ ra ở nơi ảnh tile không có — `.leaflet-container{ background:#eae3d0 }` ([`frontend/src/assets/map-style.css`](frontend/src/assets/map-style.css) dòng 51). Chặn mạng tới OSM rồi chụp lại `/map` cho ra **đúng** màu be trong ảnh báo lỗi, chỉ còn ranh giới đỏ (vector, không cần tile) vẽ đè lên. Không element nào khác trong `src/` tô màu này ở kích thước lớn.

**⛔ ĐÃ LOẠI TRỪ BẰNG SỐ ĐO — đừng điều tra lại 3 hướng này:**
- **KHÔNG phải lỗi CSS/layout.** Đo ở mọi mức zoom (viewport 1366×768): `containerClientWidth/Height` luôn = 1366×768 = kích thước thật, lưới tile phủ kín container, **`uncoveredPct: 0`** ở tất cả các bước. Triệu chứng nằm ở CSS nhưng nguyên nhân thì không — `map-style.css` vô can.
- **KHÔNG phải thiếu `invalidateSize()`.** Đúng là toàn bộ codebase không gọi hàm này ở đâu (`grep` ra 0 kết quả) và trông rất khả nghi, nhưng số đo ở trên đã bác bỏ. Đừng thêm "cho chắc" — sẽ để lại một dòng không ai dám xoá vì không ai biết nó chữa gì.
- **`#map{ padding-top:96px }` là no-op với Leaflet**, không tạo khoảng hở: pane Leaflet là `position:absolute` nên neo vào *padding box* (bỏ qua padding), và `clientHeight` cũng đã tính cả padding.

**Nguyên nhân gốc: tile không về được, và app không có gì xử lý ca đó.** 4 điểm trong [`frontend/vite.config.ts`](frontend/vite.config.ts) + [`useLeafletMap.ts`](frontend/src/composables/useLeafletMap.ts), cả 4 đều chỉ phát tác khi zoom sâu (lúc đó mọi tile đều cache-miss):
1. **100% tile đi qua service worker** — đo được `tileReqFromSW: 168`, `tileReqFromPage: 0`. SW chạy cả trong `npm run dev` vì `devOptions: { enabled: true }`.
2. **`handler: 'NetworkFirst'` không có `networkTimeoutSeconds`** → mỗi tile *bắt buộc* chờ trọn một vòng mạng tới OSM trước khi được vẽ, kể cả khi tile đó đã nằm sẵn trong cache `osm-tiles`. Mạng chậm → SW chờ vô thời hạn → Leaflet để trống → be. Comment trong file tự tố cáo lập luận sai: *"bản đồ luôn cần mới nhất khi có mạng"* — đúng với **dữ liệu** (vị trí SOS, trạng thái đội), sai với **ảnh nền raster** (OSM đổi theo đơn vị tháng, tile địa chỉ hoá bằng `z/x/y`, gần như bất biến).
3. **`a/b/c.tile.openstreetmap.org` là server cộng đồng miễn phí, không SLA**, Tile Usage Policy cho phép họ chặn bất cứ lúc nào không báo trước; zoom liên tục qua nhiều bậc trên bản đồ 123 xã/phường đúng là pattern bị throttle (429/418).
4. **`cacheableResponse: { statuses: [0, 200] }` là guard vô hiệu** — ảnh Leaflet là request `no-cors` nên SW chỉ thấy `opaque, status 0`, **không phân biệt được PNG thật với trang lỗi 429** và sẽ cache trang lỗi như một tile hợp lệ (giữ 30 ngày). Sửa `statuses` là vô ích; phải bật `crossOrigin` trên `L.tileLayer` để request thành CORS thật thì SW mới thấy status thật.

**Phát hiện kèm theo (kiểm chứng từ `node_modules/workbox-build`):** file ranh giới **đang thực sự dùng** — `public/data/lamdong-wards.geojson`, **9.66 MB, ~510k điểm** — **không được SW cache ở bất kỳ đâu**, trong khi file fallback gần như không dùng thì lại có `StaleWhileRevalidate`. Cache đang cấu hình cho đúng cái file sai:
- `runtimeCaching` urlPattern là `/\/lamdong_tinh\.geojson$/` → **không khớp** `lamdong-wards.geojson`.
- `globPatterns` mặc định = `["**/*.{js,wasm,css,html}"]` → `.geojson` không được precache.
- `maximumFileSizeToCacheInBytes` mặc định = `2097152` (2 MB) → file 9.66 MB bị loại kể cả nếu pattern có khớp.

→ **Câu chuyện offline của PWA hiện là hư cấu:** app có hàng đợi SOS offline (IndexedDB) + badge "sẽ tự gửi khi có mạng", nhưng thứ rescuer cần nhất khi ở vùng lũ mất sóng — bản đồ — thì có 200 tile `NetworkFirst` và lớp ranh giới không cache byte nào. Cắt mạng là mất sạch nền lẫn ranh giới. Đây là bất nhất kiến trúc, không phải bug lẻ.

**Ngoài ra, `preferCanvas:true` + 510k điểm làm treo main thread mỗi lần zoom** — đo `longtask`: **601ms / 684ms / 381ms / 178ms / 187ms** cho 5 bậc zoom liên tiếp. Không đủ gây màn trắng, nhưng cộng vào đúng lúc tile đang chờ thì cảm giác "đứng hình" rõ hơn. Vấn đề là 510k điểm, **không phải renderer** — đừng tắt `preferCanvas`, canvas là lựa chọn đúng ở mật độ này.

**⚠️ Vì sao phải sửa, không phải chuyện thẩm mỹ:** vùng be trống **đọc ra thành "khu vực này không có gì"**, trong khi sự thật là "nền bản đồ không tải được" — với commander đang điều phối, hai thứ đó dẫn tới hai quyết định khác nhau. Đây **cùng một họ lỗi** với P0 GPS ở Mục 15.6 (hệ thống thất bại im lặng, người dùng không có cách nào biết). PR nào sửa mục này mà chỉ đổi config cache, không làm lỗi trở nên trung thực → **request changes**.

**Kịch bản sửa — trạng thái: mục 3 đã làm (xem 15.8), 1/2/4/5 CHƯA làm:**

| # | Việc | Vì sao ở vị trí này |
|---|---|---|
| 1 | `crossOrigin` trên `L.tileLayer` + đổi sang `CacheFirst` (hoặc giữ `NetworkFirst` + `networkTimeoutSeconds: 3`) + `statuses: [200]` | Rẻ nhất, chặn ngay việc cache bị nhiễm response lỗi. `crossOrigin` là điều kiện tiên quyết để `statuses` có tác dụng — xem điểm 4 ở trên |
| 2 | Bắt event `tileerror` của Leaflet → đếm → banner *"Không tải được nền bản đồ — vị trí các marker vẫn chính xác"* | Làm lỗi trung thực. Phải đi **cùng** #1, không phải sau. Câu sau quan trọng: marker SOS/đội/ranh giới đều là vector, **vẫn vẽ đúng** trên nền trống |
| 3 | Giảm `lamdong-wards.geojson` (mapshaper, ~50–100 lần) + đưa vào runtime cache | Sửa một phát cả tải chậm (9.66 MB trên 4G vùng thiên tai) lẫn giật khi zoom |
| 4 | Đổi nhà cung cấp tile có API key (MapTiler/Stadia/Carto free tier) + referrer restriction | Đúng nhất, nhưng cần quyết định của team. Nếu giữ OSM vì thời gian → **phải ghi rõ là giới hạn đã biết ngay tại mục này**, không để nằm im như lỗi ngẫu nhiên |
| 5 | Chốt + ghi rõ phạm vi offline (đề xuất: precache tile Lâm Đồng z9–z13, `CacheFirst` phần còn lại, **tuyên bố thẳng** rằng zoom sâu hơn z13 cần mạng) | Cần #3, #4 xong mới nói được con số thật. Giới hạn tuyên bố rõ thì đáng tin; lời hứa offline không thành thì tệ hơn không hứa |

**Tiêu chí nghiệm thu (đo được, không phải "trông có vẻ ổn"):**
- Zoom z8→z16 liên tục 10 lần: **0 tile trống**.
- Cắt mạng trong DevTools rồi zoom: **có banner cảnh báo**, marker vẫn đúng vị trí.
- Long task mỗi lần zoom **< 100 ms** (hiện tại 178–684 ms).

**Cách phân biệt nhanh nguyên nhân (2) chờ mạng vs (3) bị OSM chặn, nếu tái hiện trên máy thật:** F12 → **Network** → lọc `tile.openstreetmap` → zoom vào chỗ hay trắng. Status **200** nhưng Time treo vài giây = (2). Status **429/418**, hoặc `(from ServiceWorker)` mà ảnh hỏng = (3)+(4) — kiểm tra thêm **Application → Cache Storage → `osm-tiles`**, mở một entry xem có đúng là PNG không.

### 15.8 Bug thật đã sửa (2026-09-09) — "vỡ hình" + lag mỗi lần zoom in

> Người dùng làm rõ triệu chứng thật, khác với Mục 15.7: *"khi zoom in bản đồ gây hơi lag, mỗi khi zoom in thường bị vỡ, zoom out hết cỡ thì mới trở lại bình thường"*. Không liên quan tới tile/service worker.

**Nguyên nhân gốc — xác định bằng cách đọc thẳng `node_modules/leaflet/dist/leaflet-src.js`, không suy đoán:**
1. `Canvas._update()` (dòng ~12664) **thoát sớm** khi `map._animatingZoom`: trong lúc animate zoom, canvas renderer **không** resize, **không** vẽ lại — giữ nguyên bitmap cũ.
2. `Map._animateZoom()` (dòng ~4798) gắn class `leaflet-zoom-anim` lên `mapPane`, CSS-transform kéo giãn **toàn bộ pane** (gồm cả canvas chứa nét kẻ mảnh) trong 250ms. Ảnh tile kéo giãn thì chỉ hơi nhoè; **nét vector kéo giãn thì méo, dày mỏng không đều, lệch khỏi tile bên dưới** → đúng cảm giác "vỡ hình".
3. Hết 250ms Leaflet mới thật sự vẽ lại — nhưng đo được việc này tốn **178–684ms** với 512.755 điểm, tức **gấp 1–3 lần** thời gian animation cho phép. Bấm zoom tiếp trước khi xong → méo chồng méo.
4. **Vì sao zoom out hết cỡ lại hết:** không phải nó tự phục hồi. `_tryAnimatedZoom()` (dòng ~4779) bỏ hẳn animation khi `Math.abs(zoom - this._zoom) > zoomAnimationThreshold` (mặc định **4**). Zoom out hết cỡ thường nhảy quá 4 mức → đi đường vẽ lại tức thì, sạch. Tức là người dùng đã vô tình **né** được đường code lỗi, chứ không phải sửa được nó.

**Đã sửa (2 commit):**
- [x] **Simplify lớp ranh giới bằng `mapshaper`** ngay trong `frontend/scripts/build-wards-geojson.mjs` (**không** làm tay qua mapshaper.org — script tự tải lại nguồn mỗi lần chạy nên bản sửa tay sẽ bị ghi đè mất ở lần build sau, im lặng). Dùng mapshaper vì nó **dựng topology** trước khi simplify: biên chung giữa 2 xã liền kề là cùng một cung, giản lược đúng một lần → hai bên vẫn khớp. `turf`/`simplify-js`/tự viết đều simplify từng vòng độc lập → hở khe/chồng lấn giữa 123 xã kề nhau. Kết quả: **512.755 → 57.475 điểm (÷8.9), 9.21 → 1.05 MB**. Chọn `interval=25m` theo số đo thật (15m→93.889 điểm, 25m→60.602, 40m→40.430, 100m→17.493).
- [x] **Ẩn lớp ranh giới từ zoom 14** (`ZOOM_AN_RANH_GIOI` trong `useLeafletMap.ts`). ⚠️ **BẮT BUỘC bám event `zoomend`, KHÔNG phải `zoom`/`zoomstart`** — gọi `addLayer`/`removeLayer` giữa lúc đang animate là ép Leaflet làm thêm việc đúng vào khung 250ms vốn đã không đủ, làm "vỡ hình" **nặng thêm** thay vì nhẹ đi.
- [x] **Ghi chú trong `MapLegend.vue`**: "Ranh giới chỉ mang tính minh hoạ và tự ẩn khi phóng to. Xã chính thức xác định theo toạ độ GPS." Cùng nguyên tắc với cảnh báo "vị trí ước tính" ở Mục 15.6 — báo trước, đừng để người dùng tự suy diễn sai.

**Kết quả đo (Chrome headless + CDP, 1366×768, Long Task API), 5 bậc zoom liên tiếp:**

| | bậc 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Trước | 601ms | 684ms | 381ms | 178ms | 187ms |
| Sau | 353ms* | **0** | **0** | **0** | **0** |

*bậc 1 gồm cả chi phí khởi tạo trang. Tiêu chí <100ms ở Mục 15.7 — đạt. Đã xác minh thêm bằng ảnh chụp: zoom 13 ranh giới hiện và nét vẫn mượt, zoom 15 ẩn hoàn toàn.

**⚠️ Hai điều người sau PHẢI biết:**
- **Guard "đếm số feature" sau simplify gần như vô dụng.** Kiểm chứng thật: chạy `SAI_SO_MET=20000` (20 km, hình méo hoàn toàn) **vẫn ra đủ 123 đơn vị và vẫn pass** — vì cờ `keep-shapes` giữ mọi polygon. Guard **thật sự** có tác dụng là kiểm **lệch diện tích từng xã < 12%** (đã kiểm chứng chặn đúng ở `SAI_SO_MET=200`, báo xã Phú Quý lệch 31.89%). Đừng tin kiểm đếm feature là đủ.
- **`mapshaper` kéo theo 209 gói và 5 vulnerability mới** (`@ngageoint/geopackage`, `adm-zip`, `image-size`, `file-type`, `fflate` — đều từ phần hỗ trợ GeoPackage/zip không dùng tới). Chấp nhận có chủ đích: `devDependency`, không vào bundle trình duyệt, chạy lúc build trên dữ liệu từ nguồn đã biết. Nếu team muốn gỡ, phải tìm thư viện khác **có dựng topology** — không được thay bằng `turf`/`simplify-js`.

**Không ảnh hưởng nghiệp vụ:** file geojson chỉ để hiển thị. `ward_code` của mỗi SOS do trigger `ST_Contains` ở backend suy ra từ bảng `wards` (sinh riêng bởi `gis/02-seed-wards.sql`, **giữ nguyên độ chính xác gốc**, không simplify); điều đội thì `findNearestTeams()` tính theo khoảng cách GPS thật, không theo ranh giới xã. Ở vĩ độ Lâm Đồng 1 pixel ≈ 18.7m tại zoom 13, nên sai số 25m luôn **dưới 1.3 pixel** ở mọi mức zoom mà ranh giới còn hiển thị.

### 15.9 Audit đối chiếu SRS ↔ code thật (2026-09-10) — checklist cần làm

> Rà toàn bộ `SRS-Rescue-GIS-LamdDong.docx` (trích xuất text từ `word/document.xml`, không đọc qua Word) từng chương, đối chiếu với code thật bằng `grep`/đọc trực tiếp file (không suy đoán). Mục đích: liệt kê phần SRS yêu cầu nhưng code CHƯA làm hoặc làm khác, để còn thời gian xử lý trước khi bảo vệ đồ án. Đánh dấu `[x]` khi xong — đừng xoá dòng, giữ lịch sử audit như các mục 15.x khác.

**Chưa làm — ảnh hưởng nghiệp vụ, nên ưu tiên trước:**
- [x] **F-SOS-01: "Chỉ 1 SOS active cùng lúc/user" (SRS 3.2.1) không được enforce.** `SosService.create()` ([sos.service.ts:164](backend/src/sos/sos.service.ts#L164)) không kiểm tra victim đã có SOS active (`pending/assigned/in_progress/arrived`) trước khi insert thêm — giới hạn duy nhất đang có là rate limit 5 SOS/giờ, không phải "1 active/user". `GET /api/sos/mine/active` đã có sẵn (dùng để khôi phục UI sau F5, xem Mục 15.4) nên chặn được bằng cách gọi lại chính hàm đó trong `create()` trước khi insert, ném `ConflictException` (409) nếu đã có active.
- [x] **F-GIS-01: thiếu fallback mở rộng bán kính 10km → 20km (SRS 3.3.2).** `GisService.findNearestTeams()` ([gis.service.ts:30-61](backend/src/gis/gis.service.ts#L30)) đã nhận `radiusM` làm tham số nhưng `tryAutoAssignNearestTeam` trong `sos.service.ts` chỉ gọi đúng 1 lần với `10000` cố định — không có đội trong 10km thì giữ nguyên `'pending'` luôn, không thử lại ở 20000. Cần thêm 1 lần gọi lại với `radiusM=20000` khi lần đầu rỗng. — **Đã xử lý (2026-09-11).** `tryAutoAssignNearestTeam` gọi lại `findNearestTeams(..., AUTO_ASSIGN_FALLBACK_RADIUS_M=20000, 1)` khi lần 10km rỗng; cả 2 rỗng mới giữ `'pending'`. **Phạm vi có chủ đích:** chỉ áp cho auto-assign (SRS ghi tác nhân F-GIS-01 là "Hệ thống — tự động khi có SOS mới"); `GET /api/gis/nearest-teams` của commander giữ nguyên, trả đúng bán kính `radiusMeters` được truyền, không tự mở rộng. Thêm test "mở rộng lên 20km" + assert "đã có đội trong 10km thì không gọi 20km" ở `sos.service.spec.ts`; `docs/api-contract.md` Mục 2 cập nhật mô tả.
- [x] **6.1 RescuerView: không có bản đồ/route nào trong màn hình (SRS yêu cầu "route di chuyển trên bản đồ").** [RescuerView.vue](frontend/src/views/RescuerView.vue) hiện là list thuần, chỉ có `googleMapsLink()` mở Google Maps ra ngoài app — không dùng `useLeafletMap`/`RescueMap` nào. Cần quyết định: nhúng bản đồ thật (tốn công, đúng SRS) hay sửa lại SRS chấp nhận hướng "mở Google Maps ngoài app" như hiện tại. — **Đã xử lý (2026-09-11), team chọn nhúng bản đồ thật, kiểu "đường thẳng + chỉ đường ngoài".** RescuerView giờ có bản đồ ở đầu trang (tái dùng [RescueMap.vue](frontend/src/components/map/RescueMap.vue), thêm prop `route`, nới kiểu `sosList` để nhận cả `SosRequest`): vẽ **đường thẳng nét đứt** từ GPS của rescuer (`watchPosition` sẵn có) tới nạn nhân của nhiệm vụ đang chọn (bấm thẻ hoặc marker để chọn, mặc định nhiệm vụ đầu danh sách), mỗi thẻ hiện khoảng cách chim bay + ETA ước tính 40 km/h ([utils/geo.ts](frontend/src/utils/geo.ts), công thức ETA khớp `GisService.findNearestTeams()`). Link Google Maps đổi từ "xem điểm" sang **chỉ đường** (`/maps/dir/?api=1&destination=`). **Cố ý KHÔNG dùng định tuyến đường bộ thật (OSRM demo server):** không SLA, giới hạn 1 req/s, và không chạy khi mất mạng — đúng lúc cứu hộ thực địa hay mất sóng (cùng loại rủi ro tile OSM ở 15.7); đường thẳng + ghi rõ "đường chim bay, không phải tuyến đường bộ" dưới bản đồ thì trung thực và vẫn chạy offline (tile z8–10 bundle sẵn). Nếu hội đồng hỏi "route": dẫn đường theo đường bộ giao cho Google Maps qua nút "Chỉ đường". Kiểm chứng: `geo.spec.ts` (6 test, viết trước, đỏ → xanh), 26 test FE pass, `vue-tsc` + build + eslint sạch; chụp màn hình thật (Chrome headless, leader `0900000222`, GPS giả lập tại vị trí đội) — khoảng cách hiện ≈ 1.6 km, khớp 1.626 m PostGIS tính trong DB. **Phát hiện kèm lúc chụp:** `style.css` (đã commit) có rule toàn cục `header { position: fixed; z-index: 50 }` viết cho header trang chủ nhưng áp lên MỌI thẻ `<header>` — header của RescuerView không chiếm chỗ, nội dung đầu trang (trước đây là thẻ nhiệm vụ đầu tiên, giờ là bản đồ) nằm dưới header; thêm vào đó pane Leaflet (z-index 400+) vẽ đè lên header. Đã xử lý **trong RescuerView**: `.rescuer-top { position: sticky }` + `.rescuer-map { position: relative; z-index: 0 }` (stacking context riêng cho bản đồ). **⚠️ Cập nhật 2026-09-22 (Mục 15.13): quyết định "chỉ đường thẳng, giao Google Maps" ở dòng này đã được NÂNG CẤP lên dẫn đường thật (GraphHopper tự host) — không còn là trạng thái hiện tại của RescuerView. Dòng này giữ nguyên làm lịch sử audit.**
- [ ] **DashboardView cũng dùng `<header class="dashboard-top">` nên dính cùng rule `header { position: fixed }` toàn cục ở `style.css`** (xem dòng trên) — chưa sửa, chưa kiểm chứng bằng ảnh. Sửa gốc đúng nhất: đổi selector `header` trong `style.css` thành class riêng của `AppHeader.vue`, rồi xem lại trang chủ/MapView (có thể đang dựa vào header fixed, VD `#map{padding-top:96px}` ở Mục 15.7) — khi đó override `sticky` trong RescuerView thành thừa, gỡ đi được.
- [ ] **F-PWA-04: GPS breadcrumb mỗi 2 phút kể cả offline (SRS 3.5) — hoàn toàn chưa tồn tại.** Không tìm thấy logic nào lưu tọa độ định kỳ vào IndexedDB cho mục đích này ở bất kỳ đâu trong `frontend/src`. `watchPosition` hiện có ở `RescuerView.vue`/`MapView.vue` chỉ phục vụ gửi GPS đội cứu hộ mỗi 30s khi có nhiệm vụ active (F-RT-01), không phải breadcrumb liên tục cho ca mất tích/trekking mà SRS mô tả. Nếu team quyết định bỏ tính năng này (ít giá trị demo, nhiều công), nên sửa SRS 3.5/8.2 ghi rõ "ngoài phạm vi MVP" thay vì để lệch âm thầm.

**Chưa làm — lệch nhỏ so với SRS, ưu tiên thấp hơn:**
- [ ] **F-AUTH-02: tài khoản bị khóa trả sai mã lỗi.** `auth.service.ts:28-29` trả `UnauthorizedException` (401) khi `user.isActive === false`, trong khi SRS 3.1.2 quy định 403 riêng cho "tài khoản bị khóa" (401 dành cho sai mật khẩu). Sửa bằng `ForbiddenException` cho case này.
- [ ] **NF-MAINTAIN: "mọi API endpoint có Swagger đầy đủ" (SRS 4.5) chưa đạt 100%.** Đếm được 17 route (`@Get/@Post/@Patch/@Put/@Delete`) trong `backend/src/**/*.controller.ts` nhưng chỉ 15 `@ApiOperation` — thiếu 2 route. Cần chạy lại phép đếm để xác định chính xác route nào thiếu rồi bổ sung `@ApiOperation()`.
- [ ] **NF-PERF-05 (50 WebSocket đồng thời, đo bằng Artillery.io — SRS 4.1) chưa từng được đo.** Không có config Artillery nào trong repo. NF-PERF-01→04 (độ trễ WS, tải trang, API response time, PostGIS query) cũng chỉ là chỉ tiêu trong SRS, chưa có bằng chứng đo lưu lại (Lighthouse report, `EXPLAIN ANALYZE` output...) trong repo.

**Bộ 15 test case SRS Chương 7 (TC-01→TC-15) — thiếu bằng chứng test tự động thật:**
- [ ] Backend chỉ có 5 file `*.spec.ts` (`auth.service`, `roles.guard`, `sos.service`, `users.service`, `app.controller` mặc định) — toàn bộ là **unit test với fake tay**, không phải test qua HTTP thật. `backend/test/app.e2e-spec.ts` **vẫn là scaffold mặc định của Nest** ("Hello World") — chưa có Supertest e2e nào cho luồng SOS/Auth thật dù `test/jest-e2e.json` đã cấu hình sẵn. Không có Playwright dù CLAUDE.md Mục 3.2/14 liệt kê `webapp-testing` skill riêng cho việc này.
- [ ] **Có tương đương** (unit, không phải HTTP thật): TC-01/02 (đăng ký), TC-03/04 (đăng nhập), TC-07/08 (hủy SOS), TC-10 (phân quyền qua `roles.guard.spec.ts`).
- [ ] **Hoàn toàn chưa có test nào**, kể cả unit: TC-05/06 (gửi SOS + rate limit 429 qua HTTP thật), TC-09 (0 file spec cho `GisService`), TC-11 (độ trễ WebSocket < 2 giây — cần 2 client giả lập), TC-12 (SMS thật gửi trong 30s — `NotificationsService` không có spec), **TC-13 (SQL Injection — không có test nào chủ động chèn payload `'; DROP TABLE...` để CHỨNG MINH parameterized query chống được, dù code đã dùng đúng cách)**, TC-14 (offline queue có `offlineQueue.spec.ts` test logic store, nhưng không phải test end-to-end thật "tắt mạng → lưu IndexedDB → tự POST khi có mạng lại"), TC-15 (route `/api/auth/refresh` không tồn tại nên test cũng vô nghĩa cho tới khi làm mục dưới).

**Đã biết từ Mục 15.1-15.6, xác nhận lại vẫn còn đúng tính đến 2026-09-10 (không lặp lại toàn bộ chi tiết, xem mục gốc):**
- [ ] `POST /api/auth/refresh` chưa tồn tại — SRS TC-15 giả định có (xem 15.3).
- [ ] `GET /api/health` chưa có — ảnh hưởng NF-REL-01 đo uptime trên Render free tier (xem 15.5).
- [ ] `GET /api/gis/sos-heatmap` có ở BE nhưng DashboardView chưa gọi/vẽ — phần "thống kê" ở SRS 6.1 chưa đầy đủ (xem 15.6 P2).
- [ ] `CreateSosDto.imageUrl` chỉ `@IsString()` không `@IsUrl()`, và **frontend chưa có tính năng chụp/tải ảnh thực địa nào** dùng field này — SRS 3.2.1 liệt `imageUrl` là input hợp lệ của F-SOS-01 nhưng chưa có UI thật (xem 15.6 P2).

**Không phải lỗi — SRS lỗi thời, nên cập nhật tài liệu trước khi bảo vệ (để hội đồng khỏi thắc mắc sai chỗ):**
- [ ] SRS Chương 5 (Mô hình dữ liệu) mô tả `district_code` (12 huyện/TP) ở cả 3 bảng `users`/`sos_requests`/`rescue_teams` — thực tế đã migrate hẳn sang `ward_code` (123 xã/phường) từ sau sáp nhập hành chính 2025-08-24 (xem Mục 6, `gis/03-migrate-existing-tables.sql`). Code đúng theo thực tế hành chính hiện hành; SRS mới là bên lỗi thời, cần sửa lại SRS chứ không phải code.
- [ ] SRS 3.1.1 mô tả đăng ký có input "Vai trò" (role) — thực tế đã **cố ý bỏ hẳn** field `role` khỏi `RegisterDto` ([register.dto.ts](backend/src/auth/dto/register.dto.ts)) để vá lỗ hổng leo thang đặc quyền (xem Mục 15.6 P0). Hệ thống hiện an toàn hơn SRS mô tả — cần chuẩn bị giải thích lý do lệch có chủ đích này khi bảo vệ, và nên cập nhật lại SRS 3.1.1 cho khớp.

### 15.10 Bug thật đã sửa (2026-09-11) — leader không thấy nhiệm vụ được auto-assign ở xã khác

> Người dùng báo qua test tay: victim (xã Lâm Viên - Đà Lạt, `24778`) gửi SOS, commander thấy SOS đã tự động được phân công, nhưng đăng nhập vào tài khoản leader của đúng đội được giao lại **không thấy nhiệm vụ nào**.

**Nguyên nhân gốc:** hai cơ chế trong hệ thống dùng hai tiêu chí khác nhau cho "khu vực" mà không ai đối chiếu lại với nhau:
- **Phân công** (`tryAutoAssignNearestTeam`, xem Mục 15.6 P1 và 15.9 F-GIS-01) chọn đội theo **khoảng cách GPS** (`ST_DWithin`/`ST_Distance`), đúng như spec — cố tình bỏ qua ranh giới xã để lấy đội gần nạn nhân nhất.
- **Hiển thị cho rescuer** ở CẢ 3 nơi lại lọc cứng theo **`ward_code` của tài khoản leader**: `SosService.findAll()` (`WHERE s.ward_code = user.wardCode`), `SosService.findById()` (403 nếu khác `ward_code`), và `SosGateway.handleConnection()` (chỉ join room `ward:{wardCode}`, còn `emitSosUpdated()` chỉ bắn vào `sos:{id}` + `ward:{wardCode}`). Một đội gần nạn nhân nhưng đóng ở xã khác — đúng trường hợp phân công tự động nhắm tới — bị chặn ở cả 3 nơi.

Dữ liệu demo tái hiện đúng: SOS ở xã `24778`, đội "Đội cứu hộ Xuân Hương 2" (được giao, cách 1.626 m) đóng ở xã `24781`, còn tài khoản leader (`0900000222`) lại có `ward_code=24823` — 3 mã xã khác nhau hoàn toàn, nhưng phân công vẫn đúng vì tính theo GPS chứ không theo xã nào trong 3 xã đó.

**Đã xử lý — sửa theo hướng "leader luôn thấy SOS của chính đội mình, bất kể xã", giữ nguyên hành vi cũ cho các trường hợp khác:**
- `SosService`: `SOS_DETAIL_SELECT` thêm cột `rt.leader_id AS team_leader_id`. `findById()`: rescuer được xem nếu **cùng xã** (đi tuần khu vực, hành vi cũ) **HOẶC** `team_leader_id === user.id` (đội của chính họ, hành vi mới). `findAll()`: WHERE thêm `OR s.assigned_team_id IN (SELECT id FROM rescue_teams WHERE leader_id = $user.id)` cùng logic.
- `SosGateway.handleConnection()`: rescuer join thêm room `team:{id}` cho **mọi** đội họ làm leader (dùng `RescueTeamsService.findTeamIdsByLeader()` mới thêm). `emitSosUpdated()` bắn thêm vào `team:{assignedTeamId}` khi payload có `assignedTeamId` — cả 3 nơi gọi hàm này (auto-assign lúc tạo SOS, commander phân công tay, rescuer cập nhật tiến độ) đều đã sẵn `assignedTeamId` trong payload nên không cần sửa gì ở 3 nơi gọi đó.
- **Không đổi** cách phân công (vẫn theo GPS, không theo xã) và **không đổi** quyền xem SOS *chưa phân công* trong xã của rescuer — chỉ mở thêm đúng 1 trường hợp: SOS đã giao cho đội mình thì thấy được, dù ở xã nào.
- **Có chủ đích không sửa:** dữ liệu demo (`ward_code` của leader `0900000222` lệch với `ward_code` của chính đội họ) — kể cả sửa cho khớp, SOS ở xã thứ 3 vẫn không hiện nếu không có phép sửa trên; sửa dữ liệu không thay được cho sửa logic lọc.

**Kiểm chứng theo quy trình `systematic-debugging`:** viết test tái hiện lỗi trước (`findAll`/`findById` — rescuer khác ward nhưng là leader của đội được giao) → chạy thấy đỏ (2 test fail đúng như lỗi thật) → sửa → xanh. Thêm `RescueTeamsService.findTeamIdsByLeader()`. Không có test riêng cho phần Socket.IO room (project chưa có gateway spec nào từ trước — xem khoảng trống đã ghi ở Mục 15.9), đã xác minh bằng đọc lại code thủ công thay vì test tự động. Tổng 44 test BE pass (thêm 4 so với 40 trước đó), `npx tsc --noEmit` + `npm run build` + `eslint` (không `--fix`, đúng như CI) đều sạch.

### 15.11 Bug thật đã sửa (2026-09-12) — marker đội cứu hộ không di chuyển trên bản đồ commander

> Người dùng hỏi: "khi rescuer hoặc victim di chuyển thì marker có di chuyển theo không?". Sau khi trả lời + được xác nhận phạm vi (chỉ sửa phần commander thấy đội di chuyển — **cố ý không** làm marker victim di chuyển, xem lý do dưới), phát hiện thêm 1 bug backend có sẵn đang chặn chính tính năng này hoạt động thật.

**Quyết định phạm vi (đã hỏi trước khi làm):** marker **victim** giữ nguyên là 1 điểm SOS cố định, KHÔNG làm nó di chuyển theo vị trí sống của victim. Lý do: (1) SOS là tín hiệu tại một thời điểm ("tôi gặp nạn ở đây"), không phải phiên theo dõi liên tục — rescuer nên đi tới đúng điểm báo nạn ban đầu; (2) làm việc này cần tính năng hoàn toàn chưa có (victim liên tục phát GPS, giống F-PWA-04 đã ghi "chưa tồn tại" ở Mục 15.9); (3) kéo theo quyết định riêng tư (phát vị trí sống của người đang gặp nạn) ngoài phạm vi một bugfix.

**Fix #1 — DashboardView (commander) thấy marker đội di chuyển realtime:**
- Nguyên nhân kép: (a) `useSocket({...})` ở `DashboardView.vue` chỉ đăng ký `onSosNew`/`onSosUpdated`, thiếu hẳn `onTeamLocation` dù backend đã phát `team:location-updated` mỗi 30s thật; (b) **nặng hơn:** `teams` hiển thị trên map lấy từ `GET /api/gis/nearest-teams` (`timDoiGanNhat`), mà `GisService.findNearestTeams()` lọc cứng `WHERE rt.status = 'available'` — nghĩa là đội đang **bận đi cứu hộ** (đúng đội cần theo dõi nhất) không hề hiện trên bản đồ commander ngay từ đầu, không liên quan gì tới realtime.
- Sửa: đổi nguồn `teams` sang `fetchRescueTeams()` (`GET /api/rescue-teams`, lấy MỌI đội bất kể status — đã có sẵn, RescuerView đang dùng); thêm `onTeamLocation` cập nhật `lat/lng` đúng đội theo `teamId`. Xoá `TAM_TINH`/đổi tên `taiDoiGanTamTinh()` → `taiTatCaDoi()` vì không còn dùng điểm tâm tỉnh nữa (orphan do chính thay đổi này gây ra). `modalTeams` (gợi ý phân công) **giữ nguyên** `timDoiGanNhat` — đúng ý cũ, chỉ đội `available` mới phân công được.
- **Hạn chế còn lại, cố ý không sửa lần này:** payload `team:location-updated` không mang `status`, và không route nào (assign/auto-assign/PATCH status) phát socket khi trạng thái đổi → màu marker (xanh=available/xám=busy) chỉ đúng lúc tải trang, không tự cập nhật khi đội đổi trạng thái giữa phiên (tới khi F5). Vị trí luôn đúng, chỉ màu có thể trễ.

**Bug backend có sẵn phát hiện khi kiểm chứng — chặn cả Fix #1 lẫn tính năng "rescuer gửi GPS mỗi 30s" đã có từ trước:** `PATCH /api/rescue-teams/:id/location` và `PATCH /api/rescue-teams/:id/status` **luôn trả 500**, đã kiểm chứng bằng HTTP thật (không phải unit test — 2 endpoint này chưa từng có test). Gốc rễ: `RescueTeamsService.updateLocation()`/`updateStatus()` viết `UPDATE ... RETURNING updated_at` rồi đọc thẳng `rows[0].updated_at` — đúng pattern dùng cho `INSERT ... RETURNING` ở nơi khác trong repo (chạy đúng). Nhưng đã cô lập bằng script gọi thẳng `DataSource.query()` để so sánh: **TypeORM trả `INSERT...RETURNING` dạng mảng rows thẳng, còn `UPDATE...RETURNING` dạng tuple `[rowsArray, affectedCount]`** — `rows[0]` ở đây là CẢ MẢNG rows chứ không phải 1 dòng, nên `.updated_at` là `undefined` → `.toISOString()` ném lỗi, hàm crash **trước khi kịp** `emitTeamLocationUpdated()`. Vì `team:location-updated` — chính event Fix #1 vừa nối vào — chỉ được phát ra sau dòng đó, bug này khiến Fix #1 không có gì để nhận, và khiến tính năng "rescuer gửi GPS mỗi 30s" (đã có từ trước, không phải mới) **âm thầm thất bại 500 mọi lúc**, chỉ là bị `catch {}` phía `RescuerView.vue` nuốt mất nên không ai thấy.
- Sửa: destructure đúng tuple — `const [rows] = await this.dataSource.query<[{ updated_at: Date }[], number]>(...)` ở cả 2 hàm, thay vì `const rows = await ...`.
- **Đã hỏi trước khi mở rộng phạm vi:** `grep RETURNING` toàn backend cho thấy `sos.service.ts` có 3 chỗ khác cùng họ pattern `UPDATE...RETURNING` + đọc `result[0].x` (trong `cancel()`, `assign()`, `updateStatus()` của SOS) — **CHƯA xác minh có cùng bug hay không, CHƯA sửa** — xem mục nợ ngay dưới. Chỉ sửa đúng 2 hàm trong `rescue-teams.service.ts` đã được xác nhận.
- **Kiểm chứng thật, không qua mock** (unit test hiện có dùng hand-rolled fake `dataSource.query` nên không bắt được lớp bug này — mock luôn trả đúng hình dạng "giả định", không phản ánh hành vi driver thật): gọi `PATCH /location` + `PATCH /status` qua HTTP thật → 200 (trước đó 500); đặt 1 đội `busy` + đổi vị trí trong lúc `DashboardView` đang mở → chụp ảnh trước/sau xác nhận marker tách ra đúng vị trí mới, không cần F5. `npm test` 44/44 pass, `eslint`/`npm run build` sạch. Dữ liệu demo bị lệch tạm thời trong lúc dò lỗi đã được khôi phục đúng giá trị gốc bằng SQL trực tiếp.

**Nợ chưa xử lý, mức độ nghiêm trọng CAO — cần xác nhận riêng trước khi sửa:**
- [x] **Khả năng cùng 1 lớp bug (`UPDATE...RETURNING` đọc sai tuple) đang ảnh hưởng `sos.service.ts`** ở `cancel()` (dòng ~399, `RETURNING late_cancel_count, is_flagged`), `assign()` (dòng ~484, `RETURNING updated_at` — commander phân công tay), `updateStatus()` (dòng ~548, `RETURNING updated_at` — rescuer cập nhật tiến độ). Nếu đúng, nghĩa là `PATCH /api/sos/:id/cancel`, `PATCH /api/sos/:id/assign`, `PATCH /api/sos/:id/status` đang **trả 500 trong thực tế** dù test unit vẫn xanh (cùng lý do: mock hand-rolled trả đúng hình dạng giả định, không phản ánh driver thật) — CHƯA xác minh bằng HTTP thật, CHƯA sửa. Đây là mức độ nghiêm trọng cao vì đụng tới toàn bộ vòng đời SOS (huỷ, phân công, cập nhật tiến độ) — cần xác nhận riêng với team trước khi sửa, không tự ý mở rộng từ Mục 15.11 sang. — **Đã xác nhận + xử lý (2026-09-12), team đồng ý.** Đúng là cùng bug ở cả 3 hàm. Tái hiện đỏ trước: sửa 4 mock trong `sos.service.spec.ts` sang đúng hình dạng driver thật `[[row], 1]` (mock cũ `[{row}]` chính là lý do test xanh giả) → **4 test fail**, 3 cái ra **đúng y lỗi trong log production** (`Cannot read properties of undefined (reading 'toISOString')`), cái thứ 4 là nhánh huỷ trễ (`accountFlagged` sai). Sửa: `const [updated] = await this.dataSource.query<[Row[], number]>(...)` ở cả 3 hàm → 44/44 test xanh, `eslint` + `build` sạch. **Hệ quả thật trước khi sửa:** vì `UPDATE` chạy xong mới crash ở bước đọc kết quả, DB VẪN được ghi (trạng thái SOS đổi, đội được giải phóng, timeline có dòng mới) nhưng HTTP trả 500 và **socket `sos:updated` không bao giờ được phát** — người dùng thấy toast lỗi, màn hình không tự cập nhật, phải F5 mới thấy trạng thái thật. Riêng nhánh huỷ trễ: `late_cancel_count` vẫn tăng trong DB nhưng victim nhận 500 thay vì cảnh báo bị flag. **Chưa kiểm chứng qua HTTP thật** cho 3 endpoint này (khác `rescue-teams` ở trên): muốn vậy phải tạo SOS mới, mà `NotificationsService.sendSosSms()` gọi eSMS thật mỗi lần tạo SOS (không bỏ qua khi thiếu cấu hình) — không tự ý gây gửi SMS thật/tốn credit. Bằng chứng thay thế: script cô lập chứng minh driver trả tuple cho mọi `UPDATE...RETURNING` + cùng cách sửa đã kiểm chứng HTTP 500→200 ở `rescue-teams` + test đỏ→xanh với mock đúng hình dạng. **Bài học cho người sau:** mock `dataSource.query` cho `UPDATE/DELETE ... RETURNING` PHẢI trả `[[rows], affectedCount]`, không phải `[rows]` — mock sai hình dạng sẽ che mất đúng lớp bug này.

**Fix #2 (2026-09-12) — victim thấy đội cứu hộ được giao đang tới, bằng POLL chứ không phải socket (team chọn sau khi được báo cáo 2 hướng):**
- **Vì sao poll, không socket:** `useSos.ts` đã có sẵn `batDauTheoDoi()` poll `GET /api/sos/:id` mỗi 20s (viết ra chính vì targeting socket theo `ward:*` không đáng tin — cùng lớp lỗi Mục 15.10). GPS đội chỉ mới tối đa mỗi 30s (RescuerView gửi định kỳ), nên đẩy qua socket cũng không làm dữ liệu mới hơn. Hướng socket từng đề xuất (room `user:{userId}` + `socketsJoin()` lúc giao đội) bị loại vì thêm cả một cơ chế room mới mà không có lợi ích thực tế. **Không đụng** `sos.gateway.ts`, `socket-events.types.ts`, không route mới.
- Backend: `SOS_DETAIL_SELECT` thêm `ST_Y/ST_X(rt.current_location::geometry) AS team_lat/team_lng` qua đúng `LEFT JOIN rescue_teams` sẵn có (nên có ở cả `GET /api/sos/:id` lẫn `/mine/active`). Frontend: `SosRequest` thêm `team_lat/team_lng`; `ActiveSos` thêm `teamLat/teamLng`, gán lúc `khoiPhucSosDangHoatDong()` và **mỗi lượt poll** (trước đây poll chỉ cập nhật `status`); `useLeafletMap.capNhatMarkerDoiCuuHo()` vẽ chấm xanh dương (cùng quy ước màu "đội" với `RescueMap.vue`); `MapView.apDungMarkerSos()` gọi hàm này **chỉ khi SOS chưa kết thúc** — poll dừng lúc resolved/cancelled nên để lại chấm đội sẽ gây hiểu nhầm đội còn đó.
- **Quyết định có chủ đích (phương án A):** SOS vừa gửi phải chờ lượt poll đầu (tối đa 20s) mới thấy marker đội, dù auto-assign đã chạy đồng bộ — không gọi thêm `GET /:id` ngay sau `POST /sos` cho đơn giản.
- **Giới hạn đã biết:** (1) trễ tối đa ~50s (poll 20s + GPS đội 30s) — đủ để thấy "đội đang tới", không phải dẫn đường; (2) `rescue_teams.current_location` là vị trí **gần nhất từng ghi nhận**, có thể còn từ nhiệm vụ trước nếu rescuer chưa gửi GPS lần nào kể từ khi được giao — marker khi đó gây hiểu nhầm "đội đang ở đây", chưa có dấu hiệu cảnh báo kiểu "vị trí ước tính" (Mục 15.6); (3) khi đội ở rất gần SOS (ảnh kiểm chứng: cách ~11 m), **pin SOS che gần hết chấm đội** ở mọi mức zoom thường dùng.
- Kiểm chứng: test viết trước, đỏ → xanh — BE thêm 1 test (`findMyActive` SQL có `team_lat/team_lng`, tổng 45 pass), FE thêm 2 test (`khoiPhucSosDangHoatDong` mang toạ độ đội; lượt poll cập nhật toạ độ đội — fake timers, tổng 28 pass); lint + build (có `vue-tsc`) sạch cả 2 workspace. Thật: `GET /api/sos/mine/active` trên SOS thật của một victim thử (đã ẩn số điện thoại) trả đúng `team_lat/team_lng`; ảnh chụp `/map` của victim thấy chấm xanh đội cạnh pin SOS. **Không kiểm chứng được bằng ảnh việc marker DI CHUYỂN** (cần ghi DB để giả lập đội di chuyển trong lúc victim đang có SOS thật) — phần đó chỉ có unit test.
- **⚠️ Sự cố do agent gây ra lúc kiểm chứng:** script kiểm chứng đầu tiên có khối dọn dẹp ghi `current_location` của đội "Xuân Hương 2" về toạ độ seed **vô điều kiện**, kể cả khi script tự dừng sớm (vì phát hiện victim đang có SOS thật). Đội này đang `busy` cho SOS thật đó và có `updated_at` 16:28 — nhiều khả năng là 1 lần app rescuer gửi GPS thật, và giá trị đó đã bị ghi đè (không lưu lại được giá trị cũ). Tự đúng lại ở lần rescuer gửi GPS kế tiếp; log backend lúc đó (TypeORM in `PARAMETERS`) có giá trị gốc nếu cần. Bài học: khối dọn dẹp của script kiểm chứng chỉ được hoàn tác đúng những gì chính script đã ghi.

### 15.12 Bug thật đã sửa (2026-09-13) — GPS SOS lệch, bản đồ trắng trên điện thoại, Viettel chặn openstreetmap.org

**1. Toạ độ SOS lệch ~100–200 m so với thực tế.** `getCurrentPosition()` trong `MapView.vue` thiếu `enableHighAccuracy` (trình duyệt được phép dùng định vị Wi-Fi/trạm phát sóng thay vì GPS), `timeout` chỉ 5s, và `pos.coords.accuracy` chưa từng được đọc — mọi kết quả "thành công" bị coi là chính xác. Sửa: tách ra `utils/geolocation.ts` (`enableHighAccuracy: true`, timeout 15s, `accuracy > 100 m` → `uocLuong=true` tái dùng cảnh báo "vị trí ước tính" của Mục 15.6), badge "Đang xác định vị trí GPS…" trong lúc chờ (nút SOS ẩn), sửa câu toast không còn khẳng định cứng "tâm tỉnh". Test: `geolocation.spec.ts` (5). Người dùng xác nhận trên điện thoại thật: vị trí đúng. ⚠️ **Test trên laptop luôn lệch và KHÔNG phải bug** — laptop không có chip GPS, `enableHighAccuracy` chỉ là gợi ý, trình duyệt vẫn chỉ có định vị Wi-Fi.

**2. Điện thoại mở bản đồ thấy ô trống màu nền phủ đúng vùng tỉnh.** Màn ~390px mở ở **zoom 7** để vừa cả tỉnh; `duongDanTileOffline()` chỉ chặn trên (`z > 10`) mà không chặn dưới → trả `/tiles/7/...` trong khi `public/tiles/` chỉ có z8–10 → Vite trả `index.html` (200, `text/html`) → ảnh hỏng. Laptop 1366px mở ở z8+ nên chưa từng thấy (mọi số đo ở Mục 15.7/15.8 đều ở 1366×768). Gốc rễ: mức zoom thấp nhất chỉ nằm trong `build-offline-tiles.mjs` (`const ZOOM_MIN = 8` riêng), code runtime không biết. Sửa: `OFFLINE_TILE_MIN_ZOOM` export từ `tileProvider.ts`, script import dùng chung. Test: `tileProvider.spec.ts`. Kiểm chứng: Chrome headless 390px, log ngrok thấy đúng điện thoại thật đã gọi `/tiles/7/` 4 lần trước khi sửa.

**3. Điện thoại mất nền bản đồ ở mọi zoom tải qua mạng (z7, z11+), cả bản đồ rescuer — do Viettel chặn DNS, KHÔNG phải code.** DNS router nhà và **DNS Viettel hỏi thẳng (203.113.131.1)** đều trả `127.0.0.1`/`::1` cho `a.tile.openstreetmap.org` — và cả `wiki.openstreetmap.org`, tức chặn nguyên tên miền `openstreetmap.org`; Google DNS / Cloudflare trả IP thật. Router không có bộ lọc quảng cáo (tên miền quảng cáo phân giải bình thường). Laptop không tái hiện được vì đang bật Cloudflare WARP. Sửa: `TILE_URL` → `https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` (style HOT do OSM France host — cùng dữ liệu OSM, không key, CORS `*` ở cả a/b/c, DNS Viettel không chặn, có tile tới z20, không lặp nhãn); `TILE_HOST_PATTERN` + attribution đổi theo; test khoá "không trỏ vào `*.openstreetmap.org`", "không dùng `tile.openstreetmap.de`" và "pattern cache khớp `TILE_URL`". Kiểm chứng: Chrome headless 390px zoom z7→z18, 0 ảnh hỏng, không lỗi CORS, **đã mở ảnh chụp xác nhận là bản đồ thật**.
- ⛔ **openstreetmap.de bị loại sau khi đã dùng thử (lỗi thật người dùng gặp: zoom hết cỡ → mất nền + toast "Không tải được nền bản đồ"):** ở z18 máy chủ `.de` trả **404 (text/html, KHÔNG kèm CORS)** tại nhiều vùng Lâm Đồng (có tile ở trung tâm Đà Lạt, không có ở vùng rừng). Vì app bật `crossOrigin`, trình duyệt báo **"lỗi CORS"** — gây hiểu nhầm, lỗi thật là "không có tile". `.fr` trả tile rừng đồng màu hợp lệ (103 B) ở đúng toạ độ đó. Bài học: khi đánh giá nguồn tile, kiểm tra **cả zoom sâu nhất app cho phép**, ở cả vùng thưa dữ liệu, không chỉ ở trung tâm thành phố.
- ⛔ **Carto Voyager bị loại vì bẫy giống OSM:** trả `HTTP 200 image/png` + CORS đầy đủ, nhưng ảnh in chữ **"API KEY REQUIRED"**. Agent từng đề xuất Carto sau khi chỉ kiểm header — **khi đánh giá nguồn tile, luôn MỞ ẢNH ra xem, không tin status/header**.
- ⚠️ **Đính chính:** trong phiên này từng ghi "Stadia cũng bị Viettel chặn DNS" — **SAI**. Do regex trích IP bắt nhầm chuỗi `::1` nằm bên trong địa chỉ IPv6 thật (`2600:3c15:e001:69::1`). Kết luận về `openstreetmap.org` vẫn đúng vì kết quả có `127.0.0.1` rõ ràng. Khi soi DNS sinkhole, đọc nguyên output `nslookup`, đừng grep `::1`.
- Bộ tile đóng gói z8–10 trong `public/tiles/` vẫn là tile tải từ OSM trước khi đổi — giữ nguyên có chủ đích (không phải tải hàng loạt lần nữa). Hệ quả: zoom 10 → 11 bản đồ đổi style (OSM chuẩn → HOT), cùng dữ liệu. `build-offline-tiles.mjs` giờ thay `{s}` bằng `a` thay vì xoá — host trần `tile.openstreetmap.fr/hot/` trả 404.
- Máy chủ tình nguyện vẽ tile zoom sâu **theo yêu cầu**: lần đầu xem một vùng ở z16+ có thể chậm vài giây.
- Vận hành: `dev-dist/sw.js` chỉ sinh lại khi **khởi động lại `npm run dev`** — chưa restart thì SW lúc dev vẫn mang pattern cũ (tile vẫn tải được, chỉ không cache). Test điện thoại qua ngrok cần `frontend/.env` dùng đường dẫn tương đối (`VITE_API_BASE_URL=/api`, `VITE_SOCKET_URL=/`) — `http://localhost:3000` trên điện thoại là chính điện thoại → "Không thể kết nối máy chủ".

**Còn nợ:**
- [ ] Kiểm chứng trên điện thoại thật qua Wi-Fi Viettel, **tắt Private DNS**, sau khi restart `npm run dev` — chưa làm.
- [ ] 4G Viettel có bị chặn giống vậy không; Viettel có chặn cả theo IP không (laptop bật WARP nên không thử được) — chưa rõ.
- [ ] Điều khoản sử dụng của `tile.openstreetmap.fr/hot` chưa đọc được (wiki OSM liệt kê điều khoản cũng bị Viettel chặn). Đây vẫn là máy chủ **tình nguyện, không SLA** — lời giải cho đồ án. Triển khai thật cần nguồn có API key + giới hạn referrer, hoặc backend làm proxy tile (Mục 15.7 việc #4).

### 15.13 Nâng cấp (2026-09-22) — dẫn đường thật trên bản đồ cho RescuerView (GraphHopper tự host)

> **Thay thế/nâng cấp quyết định ở Mục 15.9** ("RescuerView: đường thẳng + chỉ đường ngoài" —
> phương án A đã chọn lúc đó vì chưa có hạ tầng routing riêng). Quang yêu cầu dẫn đường thật
> ngay trên bản đồ trong app, không mở Google Maps, theo hướng tự chủ routing giống Grab
> (nhưng dùng dữ liệu mở OSM, không tự thu thập dữ liệu như Grab thật — đã nói rõ với Quang,
> tránh hiểu nhầm khi bảo vệ đồ án). Mục 15.9 KHÔNG bị xoá — giữ làm lịch sử audit, chỉ không
> còn là trạng thái hiện tại của RescuerView nữa.
>
> **Đổi hướng trong cùng phiên làm việc:** thiết kế ban đầu là tự host GraphHopper trên Oracle
> Cloud Always Free VM (đã viết xong `infra/graphhopper/` — script setup, config, systemd,
> Nginx). Quang hỏi "có cách nào không cần chạy máy ảo không" → đổi sang gọi thẳng
> **OpenRouteService** (dịch vụ định tuyến OSM miễn phí, không cần quản lý server nào) —
> **đánh đổi có chủ đích:** đổi lấy sự đơn giản (không VM, không SSH, không systemd) bằng việc
> phụ thuộc vào một bên thứ 3 (giới hạn quota, có thể đổi điều khoản). `infra/graphhopper/`
> đã bị xoá vì không còn dùng — không để lại infra chết trong repo.

**Kiến trúc:** `RescuerView.vue` → `routingService.ts` → `GET /api/routing/route` (JWT + role
`rescuer`) → `RoutingService` (`backend/src/routing/`) → **OpenRouteService**
(`api.heigit.org`, HeiGIT — Viện Địa tin học Đại học Heidelberg, dựa trên dữ liệu OSM) qua
`POST .../v2/directions/driving-car/geojson`, xác thực bằng header `Authorization: <ORS_API_KEY>`.

**Vì sao KHÔNG cho frontend gọi thẳng ORS:** key sẽ phải nhúng vào bundle Vite (public, ai
cũng đọc được từ DevTools) — mất kiểm soát quota free tier. Giống pattern eSMS đã có sẵn (cũng
qua backend, không lộ secret ra FE).

**Đã xác nhận trực tiếp (gọi thử endpoint thật, KHÔNG đoán theo tài liệu)** vì trang docs
tương tác của ORS (`openrouteservice.org/dev`) là SPA khó cào tự động: base URL đúng là
`https://api.heigit.org/openrouteservice/v2/directions/{profile}` (không phải
`api.openrouteservice.org` như nhiều tài liệu cũ trên mạng vẫn ghi — HeiGIT đã gộp domain),
`POST .../geojson` với body `{coordinates: [[lng,lat],[lng,lat]], instructions: true}` (đã thử
gọi không kèm key, nhận đúng `401 "Authorization field missing"` — xác nhận URL/body hợp lệ,
chỉ thiếu xác thực). `language: "vi"` gửi kèm — **đã xác nhận hoạt động thật với API key thật**
(xem "Đã test với ORS_API_KEY THẬT" bên dưới): ORS trả hướng dẫn rẽ đúng tiếng Việt.

**Route thật là lớp NÂNG CAO, không thay fallback đang chạy tốt:** đường chim bay
(`utils/geo.ts`) vẫn vẽ ngay lập tức, không chờ mạng. Route thật tải bất đồng bộ, cùng nhịp
30s với việc gửi GPS đội lên server (không tạo interval riêng, tránh dội request thừa vào free
tier ORS mỗi lần GPS nhích vài mét) + tải lại ngay khi đổi nhiệm vụ đang chọn. Lỗi (thiếu
`ORS_API_KEY`, hết quota free tier, ORS lỗi/mất mạng...) → `routingService.ts` **nuốt lỗi, trả
`null`**, map tự lùi về đường chim bay — không throw, không toast (thêm cờ `khongHienToastLoi`
mới vào interceptor toàn cục `http.ts`, vì interceptor cũ hiện toast cho MỌI lỗi kể cả 503, sẽ
spam "Máy chủ đang gặp sự cố" mỗi 30 giây cho một tính năng vốn dĩ chỉ là nâng cao). Link "Chỉ
đường (Google Maps)" giữ nguyên làm phương án cuối cùng. **(Từ 2026-10-06 link chỉ hiện khi đường bộ trong app
không dùng được — xem Mục 15.18.)**

**Bẫy toạ độ, cùng họ với `ST_MakePoint(lng, lat)` ở PostGIS:** ORS nhận VÀ trả toạ độ theo
CÙNG chuẩn GeoJSON `[lng, lat]` (khác GraphHopper, nơi request "lat,lng" nhưng response
"lng,lat" — 2 chiều khác nhau trong 1 API). Dù ORS nhất quán hơn, `Leaflet` vẫn dùng
`[lat, lng]` nên `RoutingService.findRoute()` (`backend/src/routing/routing.service.ts`) vẫn
phải đảo lại geometry response trước khi trả cho frontend — xem comment cảnh báo trong code.

**Đã tra thật OSM có đủ dữ liệu đường không (Overpass API, không đoán):** khung toạ độ bao
Lâm Đồng mới (9.97–12.81°N, 107.21–109.09°E) có **217.619 đoạn đường tổng**, trong đó
**163.798 (~75%) là đường ô tô đi được** (`primary/secondary/tertiary/residential/
unclassified/service`), phần còn lại là đường mòn/lối đi bộ. Mật độ tổng thể ổn, đặc biệt
quanh Đà Lạt/Bảo Lộc/Phan Thiết (đô thị, du lịch, được cộng đồng OSM vẽ kỹ). **Chưa kiểm
chứng được** từng xã cụ thể (Overpass API công khai bị rate-limit khi thử so sánh Đà Lạt vs 1
vùng xa) — nghi ngờ hợp lý là các xã vùng sâu/miền núi thuộc phần Đắk Nông cũ sáp nhập vào có
thể thưa dữ liệu hơn. Đã dặn Quang tự kiểm nhanh 2-3 xã hay dùng để demo bằng
[Overpass Turbo](https://overpass-turbo.eu) trước khi bảo vệ đồ án.

**File mới:**
- Backend: `backend/src/routing/{routing.service.ts, routing.controller.ts, routing.module.ts, dto/route-query.dto.ts, routing.service.spec.ts}` — role `rescuer`, trả 503 (không crash boot) khi thiếu `ORS_API_KEY`/lỗi mạng/ORS không tìm được tuyến. `env.validation.ts` + `.env.example` thêm `ORS_API_KEY` (optional, giống pattern ESMS_*).
- Frontend: `frontend/src/services/routingService.ts` (nuốt lỗi, trả `null`); `http.ts` thêm cờ `khongHienToastLoi`; `RescueMap.vue` thêm prop `routeThat` (vẽ liền nét khi có, lùi về `route` chấm chấm khi không); `RescuerView.vue` gọi `layTuyenDuongThat`, hiện khoảng cách/ETA thật + danh sách hướng dẫn rẽ (tối đa 8 bước, có "+N bước nữa") **(danh sách chữ này sau đó đã được thay bằng giọng đọc —
xem Mục 15.18)**.

**Đã kiểm chứng (2026-09-22):** backend `npm run build`/`npm test` (4 test cho `RoutingService`:
đảo đúng toạ độ lng/lat→lat/lng, 503 khi thiếu key, 503 khi axios lỗi/timeout, 503 khi
`features` rỗng — tổng 49 test pass)/`eslint` (không `--fix`) đều sạch. Frontend `npm run
build` (gồm `vue-tsc -b`)/`npm test` (41 test pass)/`eslint` đều sạch. **Test qua browser
thật** (Chrome headless, dev server thật, JWT ký tay bằng `JWT_SECRET` thật — không sửa mật
khẩu tài khoản nào trong DB): đăng nhập rescuer có nhiệm vụ active thật (SOS y tế thật, đội
"Xuân Hương 2"), map hiển thị SOS đúng, không lỗi console, không toast lặp.

**Đã test với `ORS_API_KEY` THẬT (Quang gửi key ngay sau đó, cùng phiên) — xác nhận toàn bộ
chuỗi hoạt động đúng, không còn là giả định:**
- Gọi thẳng ORS bằng script cô lập: `POST .../geojson` trả `200`, `distance=2433.2m`,
  `duration=189.3s`, 79 điểm toạ độ, **`language: 'vi'` hoạt động thật** — instruction thật là
  *"Đi theo hướng Hướng tây trên đường Trần Quốc Toản"* (không còn là "best-effort chưa xác
  nhận" như ghi trước đó ở đoạn "Bẫy toạ độ" bên trên).
- Gọi qua đúng `GET /api/routing/route` (dev server backend thật, JWT hợp lệ cho rescuer
  `0900000222`, từ vị trí đội "Xuân Hương 2" tới SOS thật cách ~3.7km chim bay): `200 OK`,
  `distance_meters: 7091`, `duration_seconds: 599`, `geometry` đúng thứ tự `[lat, lng]` (số
  đầu ~11.95xx, số sau ~108.44xx — khớp Đà Lạt, không bị đảo ngược) — xác nhận
  `RoutingService.findRoute()` đảo toạ độ đúng qua toàn bộ chuỗi thật, không chỉ qua unit test
  mock. Route thật dài hơn hẳn đường chim bay (7km vs 3.7km) vì đi theo đường thật, không phải
  do lỗi — đúng như kỳ vọng.
- **Vẫn chưa test được:** GPS thật trên trình duyệt di động (Chrome headless trong session này
  không giả lập được `watchPosition` sau khi component đã mount) và giao diện thật trên điện
  thoại (route liền nét + panel hướng dẫn rẽ hiển thị đúng trên màn hình nhỏ).

**Còn nợ, Quang tự làm:**
- [x] ~~Đăng ký free tier + điền `ORS_API_KEY`~~ — xong, đã điền vào `backend/.env` và test thành công (xem trên).
- [ ] Test trên điện thoại thật với nhiệm vụ active thật — xác nhận route liền nét + panel hướng dẫn rẽ hiển thị đúng trên màn hình nhỏ, và tự kiểm 2-3 xã hay demo bằng Overpass Turbo (xem phần "Đã tra thật OSM" ở trên).
- [ ] Đọc kỹ điều khoản/hạn mức free tier của ORS trước khi demo đông người dùng cùng lúc (hội đồng bảo vệ, nhiều rescuer test song song) — free tier có giới hạn request/phút, request/ngày.

**Bổ sung (2026-09-22, cùng ngày) — giới hạn `/api/routing/route` chỉ trong phạm vi tỉnh Lâm
Đồng:** Quang hỏi có file `lam_dong_data.json` (kinh độ/vĩ độ toàn bộ xã/phường sau sáp nhập)
muốn dùng để "tìm đường trong phạm vi bao quanh". File đó **không tồn tại trong repo** (đã
`glob` xác nhận) — nhưng dữ liệu tương đương **đã có sẵn**: `wards.boundary`
(GEOMETRY(MultiPolygon,4326), PostGIS) phủ đúng 123 xã/phường Lâm Đồng mới, hợp của toàn bộ
ward chính là ranh giới tỉnh. Không cần thêm file/bảng nào — dùng lại nguồn này.

Đã hỏi rõ mức độ mong muốn (2 hướng khác hẳn nhau): **(1) validate đầu vào** — kiểm tra 2 điểm
trước khi gọi ORS, không nằm trong tỉnh thì từ chối luôn, không đổi cách route được tính; hay
**(2) ép engine chỉ đi đường bên trong ranh giới** — không khả thi hợp lý với ORS hosted (chỉ
có `avoid_polygons` để TRÁNH 1 vùng, không có "chỉ định tuyến trong vùng này"; muốn làm được
phải tính vùng "ngoài ranh giới" làm vùng tránh — phức tạp, tốn quota, và không cần thiết vì
SOS/đội cứu hộ vốn luôn ở trong tỉnh). Quang chọn **(1)**.

**Đã triển khai (1):** `GisService.isPointInProvince(lat, lng)` mới
([gis.service.ts](backend/src/gis/gis.service.ts)) — `SELECT EXISTS(... WHERE
ST_Contains(boundary, ST_SetSRID(ST_MakePoint($lng,$lat),4326)))` trên bảng `wards`.
`RoutingService.findRoute()` gọi hàm này cho CẢ 2 điểm (song song, `Promise.all`) **trước** khi
gọi OpenRouteService — điểm nào ngoài tỉnh (VD: toạ độ Hà Nội) → `400 BadRequestException`
"Điểm xuất phát hoặc điểm đến nằm ngoài phạm vi tỉnh Lâm Đồng — không tìm đường", **không gọi
ORS** (đỡ tốn quota free tier cho toạ độ chắc chắn sai). `RoutingModule` import `GisModule` để
inject được `GisService`. Phía frontend **không cần sửa gì** — `routingService.ts` đã nuốt mọi
lỗi (400 lẫn 503) và trả `null`, tự lùi về đường chim bay, không phân biệt 2 mã lỗi này.

Kiểm chứng: thêm `gis.service.spec.ts` (mới — trước đây `GisService` chưa có test nào, xem nợ
đã ghi ở Mục 15.9) + 2 test trong `routing.service.spec.ts` (chặn khi điểm đi/điểm đến ngoài
tỉnh, không gọi axios) — tổng 53 test BE pass, `npm run build`/`eslint` (không `--fix`) sạch.
`docs/api-contract.md` Mục 3 cập nhật thêm response `400`.

### 15.14 Tính năng mới (2026-09-25) — Quản lý cảnh báo/chặn đường (3/4 việc "admin" liệt kê ở
Mục 11) + hoàn thiện Thống kê tổng quan (2/4)

> Tiếp nối danh sách 4 việc "hệ thống giám sát tổng quan (commander)" mà audit trước đó xác
> nhận CHƯA hề tồn tại (không bảng DB, không backend, không frontend): (1) Quản lý người dùng —
> xong ngày 2026-09-25 cùng phiên trước Mục này (`UsersController`, `UsersView.vue`, route
> `/users`); (2) Thống kê tổng quan — xong cùng ngày (`GisService.getStats()`,
> `StatsView.vue`, route `/stats`); (3) Quản lý cảnh báo/chặn đường — xong trong Mục này; (4)
> Cấu hình hệ thống/xem log — CHƯA làm, để lại cho phiên sau.

**Thiết kế:** commander chọn 1 điểm trên bản đồ + bán kính (hình tròn, không phải vẽ polygon
tay — đơn giản cho việc đánh dấu nhanh) để đánh dấu sạt lở/cây đổ/ngập lụt/nguy hiểm khác.
Cảnh báo hiện cho MỌI vai trò đã đăng nhập xem (an toàn thực địa, không chỉ commander), nhưng
chỉ commander tạo/gỡ được. Điểm khác biệt với 1 CRUD đơn thuần: cảnh báo active được buffer
bằng PostGIS (`ST_Buffer` theo mét thật, không phải độ kinh/vĩ) thành `avoid_polygons` gửi cho
OpenRouteService — `RoutingService.findRoute()` (RescuerView, Mục 15.13) tự động TRÁNH vùng
cảnh báo khi tính đường, đúng yêu cầu gốc của Quang ("để thuật toán tìm đường khác đi").

**Bảng mới:** `gis/09-create-road-hazards.sql` — `road_hazards` (type, description, location,
radius_meters ≤5000m, ward_code tự suy ra qua trigger `set_ward_code_from_location()` DÙNG LẠI
từ `03-migrate-existing-tables.sql`, created_by, is_active, resolved_at), GiST index, RLS bật
không policy (cùng cách làm với `rescue_teams`). **Cần tự chạy trên Supabase SQL Editor** (agent
không tự chạy migration lên DB thật — cùng quy ước đã áp dụng cho 05/06/07/08) — SAU 01-03.

**Backend:** `backend/src/hazards/` (`hazards.service.ts`, `hazards.controller.ts`,
`hazards.module.ts`, `hazard.types.ts`, `dto/create-hazard.dto.ts`) — `GET /api/hazards` (mọi
role, active only), `GET /api/hazards/all` (commander, gồm đã gỡ), `POST /api/hazards`
(commander), `PATCH /api/hazards/:id/resolve` (commander, soft — set `is_active=false`, không
hard-delete, giữ lịch sử audit giống `is_flagged` thay vì xoá). Tạo/gỡ cảnh báo phát
`notification:system` (Mục 8 — type đã định nghĩa từ lâu nhưng CHƯA từng được emit ở đâu, xem
audit cũ) qua `SosGateway.emitSystemNotification()` mới thêm — bắn tới `province:lamdong` +
`ward:{code}` nếu suy ra được xã.

`HazardsService.findActiveAvoidPolygons()` gộp `ST_Buffer(location::geography,
radius_meters)` của mọi cảnh báo active thành 1 GeoJSON MultiPolygon; `RoutingService` gọi hàm
này và gắn vào `options.avoid_polygons` trong request ORS — bỏ hẳn field `options` (không gửi
mảng rỗng) khi không có cảnh báo nào, tránh phải đoán ORS xử lý mảng rỗng ra sao.

**⚠️ CHƯA xác nhận trực tiếp `options.avoid_polygons` với ORS thật** (khác base URL/coordinate
order/alternative_routes ở Mục 15.13, đều đã gọi thử endpoint thật) — `api.heigit.org` không
kết nối được từ môi trường lúc viết tính năng này (`ECONNREFUSED`, đã thử cả qua Bash lẫn qua
trình duyệt, DNS phân giải đúng IP thật nên không phải kiểu bị chặn DNS như Viettel ở Mục
15.12 — nhiều khả năng ORS tạm ngừng hoạt động lúc đó). Tham số này là hành vi ORS Directions
API đã ổn định/tài liệu hoá từ lâu nên triển khai theo đúng tài liệu, nhưng nếu sai cú pháp,
catch sẵn có vẫn bắt được và trả 503 (frontend lùi về đường chim bay, không vỡ tính năng
chính) — **cần Quang tự verify lại với `ORS_API_KEY` thật ngay khi ORS truy cập được**, ghi
tiếp vào Mục này.

**Frontend:** `hazardsService.ts` (4 hàm khớp 4 endpoint). `RescueMap.vue` thêm prop `hazards`
(vẽ `L.circle` bán kính MÉT THẬT — khác `L.circleMarker` bán kính pixel đã dùng cho SOS/đội —
cùng bán kính PostGIS đang dùng để tính `avoid_polygons`, không phải ước lượng riêng ở FE) +
prop `placingHazard` (đổi con trỏ crosshair, click bản đồ emit `pick-location` thay vì hành vi
khác). `DashboardView.vue` thêm tab thứ 2 ở panel phải ("Cảnh báo/chặn đường") + nút "+ Đánh
dấu cảnh báo" (bật chế độ chọn điểm) + modal tạo cảnh báo (loại/bán kính/mô tả) + nút "Gỡ cảnh
báo" cho từng cảnh báo active. `RescuerView.vue` chỉ hiển thị read-only (`layCanhBaoDangHoatDong()`,
không có quyền sửa) — để rescuer hiểu TẠI SAO route thật đôi khi đi vòng.

**Kiểm chứng:** Backend — `hazards.service.spec.ts` (9 test, mock đúng hình dạng tuple
`UPDATE...RETURNING` theo bài học đã ghi ở Mục 15.11) + 2 test mới trong
`routing.service.spec.ts` (có/không avoid_polygons trong body ORS) — tổng 75 test BE pass,
`npm run build`/`eslint` (không `--fix`) sạch. Frontend — build/`vue-tsc`/eslint/41 test đều
sạch. **Test qua browser thật** (dev server thật, JWT commander thật) — xác nhận toàn chuỗi
wiring đúng dù bảng chưa tồn tại trên Supabase: `GET /api/hazards/all` → 500 "relation
road_hazards does not exist" (đúng như kỳ vọng, KHÔNG phải lỗi code — Postgres parse SQL
thành công, chỉ thiếu bảng); UI không crash, hiện "Chưa có cảnh báo nào." + toast lỗi chung
đúng 1 lần (không lặp); bấm "+ Đánh dấu cảnh báo" → crosshair → click bản đồ → modal hiện đúng
toạ độ thật click được (11.80821, 108.71817) → submit → log backend xác nhận
`INSERT INTO road_hazards` nhận đúng tham số theo đúng thứ tự `ST_MakePoint(lng, lat)`
(`108.71817..., 11.80821...`) + `created_by` đúng UUID commander thật. **Cần Quang tự chạy
`gis/09-create-road-hazards.sql` trên Supabase để tính năng hoạt động thật** — sau đó test lại
toàn bộ luồng (tạo cảnh báo → route thật của rescuer đi vòng qua vùng đó) để xác nhận
avoid_polygons hoạt động đúng như tài liệu ORS.

**Còn nợ:**
- [x] Xác nhận `options.avoid_polygons` với ORS thật — **Đã xác nhận (2026-10-05)**, xem dưới.
- [x] Chạy `gis/09-create-road-hazards.sql` trên Supabase — xong, `GET /api/hazards/all` trả 200.
- [x] Test tạo cảnh báo chặn giữa route thật — **Đã xác nhận (2026-10-05)**, xem dưới.
- [x] Việc thứ 4/4 "Cấu hình hệ thống, xem log" — **Đã làm (2026-10-05)**, xem dưới.
- [ ] Màu marker đội cứu hộ trên `DashboardView` chưa tự cập nhật theo trạng thái đổi giữa
  phiên (nợ cũ từ Mục 15.11, không liên quan tính năng này, ghi lại để không quên).
- [ ] `hazard_resolved` trong nhật ký không biết AI gỡ (bảng `road_hazards` chưa có `resolved_by`)
  — hiện hiện "Hệ thống". Thêm cột nếu cần audit đầy đủ.

**Xác nhận avoid_polygons với ORS THẬT (2026-10-05, ORS đã online lại):** script
e2e qua HTTP thật (commander + rescuer JWT, backend chạy thật, DB thật): route gốc
(11.952,108.438 → 11.942,108.447) = 3253 m → tạo hazard `landslide` bán kính 150 m ngay điểm giữa
route (`POST /api/hazards` → 201, `ward_code` tự suy ra = 24781) → route lại = 3304 m, đi vòng, điểm gần
nhất của route mới cách tâm cảnh báo 887 m > 150 m → **ORS né đúng vùng**. Cảnh báo test đã tự gỡ
(`PATCH /resolve` → 200); dòng test còn lại trong DB ở trạng thái đã gỡ (hiện trong nhật ký).

### 15.14.1 Chọn đội theo đường bộ thật, né cảnh báo (2026-10-05)

**Lỗ hổng đã sửa:** `findNearestTeams()` (PostGIS) chỉ tính khoảng cách chim bay nên đội "gần nhất"
có thể bị sạt lở chặn mà vẫn được tự động phân công; chỉ tuyến đi của họ mới đi vòng (Mục 15.14).
**Cách làm** (`SosService.tryAutoAssignNearestTeam` + `RoutingService.pickBestTeamByRoad/estimateTravel`):
- Mỗi tầng bán kính (10 km lấy 3 đội, 20 km lấy 5 đội, theo SRS F-GIS-01) lấy các đội `available` gần nhất
  theo chim bay, tính **thời gian đi thật** từng đội qua ORS (đã né vùng cảnh báo), chọn đội **đến nhanh nhất**.
  Đội bị chặn hẳn bị loại; đội đã xét ở tầng 10 km không xét lại ở tầng 20 km. Đội đã `busy` (đã được phân
  công) không bao giờ là ứng viên vì `findNearestTeams` chỉ trả `available`.
- **Chọn theo thời gian đi thật chứ không phải "bị chặn thì loại":** đội có đường vòng nhỏ vẫn đủ điều kiện nếu
  vẫn nhanh nhất; chỉ khi vòng quá xa hoặc không có đường thì đội khác thắng. Timeline ghi rõ
  "~N phút, đã tránh vùng cảnh báo; bỏ qua K đội gần hơn vì đường bị chặn hoặc đi lâu hơn".
- **Không tốn quota ORS khi không có cảnh báo nào active** (giữ nguyên hành vi cũ, 0 lượt gọi).
- **Phân biệt "bị cảnh báo chặn" với "điểm không nằm gần đường nào"** (nạn nhân/đội giữa rừng, ORS cũng 404):
  khi ORS báo không có tuyến lúc né cảnh báo thì thử lại KHÔNG né; có đường → bị cảnh báo chặn thật (loại đội);
  vẫn không có đường → không liên quan cảnh báo, giữ đội gần nhất chim bay (không bỏ rơi SOS).
- ORS lỗi/hết quota → lùi về đội gần nhất chim bay. Mọi đội đều bị chặn ở cả 2 tầng → SOS giữ `pending`
  (log cảnh báo), commander phân công tay.
- Module: có vòng Sos → Routing → Hazards → Sos nên 3 module dùng `forwardRef`.

**Kiểm chứng:** 90 test BE (thêm 9: 6 cho `pickBestTeamByRoad`, 3 cho auto-assign) + lint/build sạch. Test thật với
ORS + DB thật (không tạo SOS để khỏi gửi SMS thật; gọi thẳng hàm chọn đội): nạn nhân (11.958,108.452), cảnh báo đặt
giữa tuyến của Xuân Hương 1: r=150 m → vẫn Xuân Hương 1 (4 phút); r=600 m → vẫn Xuân Hương 1 nhưng 8 phút
(đi vòng); r=1200 m → **chuyển sang Xuân Hương 2** (12 phút, bỏ qua 2 đội gần hơn); r=2500 m → cả 3 đội bị chặn,
không chọn ai. Không có cảnh báo: Xuân Hương 1 như cũ.

**Còn nợ / giới hạn đã biết:**
- [ ] **Chỉ áp dụng lúc TỰ ĐỘNG phân công khi tạo SOS.** Hai chỗ chưa làm: (a) danh sách gợi ý trong modal phân
  công tay của commander (`GET /api/gis/nearest-teams`) vẫn xếp theo chim bay; (b) cảnh báo mới tạo SAU khi đã phân
  công KHÔNG tự điều đội khác — đội đang trên đường chỉ đổi tuyến ở lần tải route kế tiếp. Tự đổi đội giữa chừng
  nguy hiểm hơn nên cần quyết định riêng.
- [ ] Mỗi lần tạo SOS khi có cảnh báo tốn tối đa 3 (tầng 1) + 5 (tầng 2) lượt ORS, cộng thêm lượt kiểm tra lại không
  né cảnh báo khi bị chặn — free tier có hạn mức, theo dõi nếu demo đông.

### 15.18 Link Google Maps chỉ còn là dự phòng + đo tuyến "nhanh nhất" (2026-10-06)

Quang hỏi lại: phần nạn nhân xem vị trí đội cứu hộ và phần đội cứu hộ tìm đường có hiển thị hết trên bản đồ của dự án,
không phải sang Google Maps không? Rà lại code thật thì cả hai đều vẽ bằng Leaflet của app, nhưng còn lệch 2 chỗ:
- **Link "Chỉ đường (Google Maps)" trên thẻ nhiệm vụ trước đây LUÔN hiện** (kể cả khi tuyến đường bộ đã vẽ trên bản
  đồ), và chú thích dưới bản đồ lúc ORS lỗi còn bảo bấm vào nó. Đã sửa (`RescuerView.vue`): toạ độ nạn nhân luôn hiện
  dạng chữ; link "Mở Google Maps (dự phòng)" chỉ hiện khi `hienLinkDuPhong = !routeThat && (gpsLoi || tuyenThatLoi)` —
  tức đường bộ trong app KHÔNG dùng được: không có GPS (từ chối quyền/lỗi/trình duyệt không hỗ trợ) hoặc lần tải tuyến
  thật gần nhất thất bại (ORS lỗi/thiếu key/mất mạng). Chưa có GPS lần đầu hoặc đang tải lần đầu thì CHƯA hiện (tránh
  hiện rồi biến mất sau 1–2 giây); tải lại sau lỗi cũng KHÔNG tắt link (`tuyenThatLoi` giữ tới khi một lần tải thành
  công) nên link không nháy mỗi 30 giây khi ORS còn hỏng. **Không bỏ hẳn link** vì khi ORS sập app chỉ còn đường chim
  bay, không dẫn đường được; nếu muốn bỏ hẳn thì xoá khối `<template v-if="hienLinkDuPhong">` ở thẻ nhiệm vụ.
- **"Ngắn nhất" thực ra là "nhanh nhất"** — backend không đặt `preference` cho ORS nên dùng mặc định. Đã đo 3 cặp điểm
  thật (Xuân Hương 2 → Đà Lạt, Xuân Hương 1 → Lâm Viên 1, Lâm Viên 1 → Xuân Hương 2): tuyến mặc định TRÙNG HỆT
  `fastest` ở cả 3; `shortest` ngắn hơn 0,2–2 km nhưng chậm hơn 2–7 phút (VD 13,4 km/25 phút so với 15,4 km/18 phút).
  Giữ nguyên mặc định: cứu hộ cần đến sớm nhất chứ không phải ít km nhất — đừng đổi sang `shortest`. Khi bảo vệ đồ án
  nên nói "tuyến nhanh nhất, tự né vùng cảnh báo".
- **Lệch tài liệu Mục 15.13 (không phải do đợt này)**: danh sách chữ hướng dẫn rẽ đã được thay bằng giọng đọc (Web
  Speech API, đọc khi cách điểm rẽ ≤ 60 m, cần máy có giọng tiếng Việt) — trên màn hình chỉ còn đường liền + khoảng
  cách/thời gian. Bản đồ rescuer chỉ hiện khi đang có nhiệm vụ.
- **Phía nạn nhân** (Mục 15.11 Fix #2): chấm xanh dương "Đội cứu hộ được phân công" ngay trên bản đồ `/map`, cập nhật
  bằng poll 20 giây nên trễ tối đa ~50 giây; chỉ có vị trí, không có đường/thời gian đến. Không dùng Google Maps ở
  bất kỳ chỗ nào của phía nạn nhân.
- **Kiểm chứng**: `RescuerView.spec.ts` mới (7 test, viết trước, đỏ 7/7 rồi xanh; FE tổng 62 test), eslint + vue-tsc +
  build sạch. Trên app thật, dùng một nhiệm vụ thử chèn bằng SQL trực tiếp (KHÔNG qua API nên không gọi eSMS, không phát
  socket; đã xoá ngay sau đó, DB về 0 SOS đang hoạt động): ORS hoạt động → 0 link, đường liền `#2563eb` + tuyến thay thế
  `#93c5fd` + 2 vùng cảnh báo đỏ vẽ trên bản đồ, "≈ 10,1 km theo đường bộ · ~12 phút"; ép ORS lỗi → link hiện, chú
  thích đổi, lùi về nét đứt; ORS phục hồi → link tắt, không nháy trong lúc tải lại; GPS bị từ chối → link hiện + chú
  thích GPS + 0 request tuyến. (Giả lập GPS bằng cách ghi đè `navigator.geolocation` ngay sau khi tải trang; ép ORS lỗi
  bằng cách bắt `XMLHttpRequest.open` của request tuyến.)
- **Còn nợ / giới hạn**:
  - [ ] Lần làm mới 30 giây mà thất bại thì tuyến đang hiển thị bị XOÁ (`routeThat` = null) thay vì giữ tuyến cũ thêm
    vài chục giây — ORS chập chờn một lần là đường liền biến mất, chỉ còn nét đứt + link dự phòng tới lần làm mới thành
    công kế tiếp. Chưa sửa.
  - [ ] Chưa thử trên điện thoại thật (GPS thật, giọng đọc tiếng Việt, bấm link dự phòng mở app Google Maps).

### 15.17 Báo cáo cộng đồng — camera bắt buộc, thông báo realtime, gộp báo cáo trùng, lịch sử (2026-10-05)

Hoàn thiện 3 khoản nợ của Mục 15.16 và siết độ xác thực theo yêu cầu của Quang: người dân báo sạt lở **phải cho
phép camera và chụp ảnh tại hiện trường**, quản trị viên được báo ngay, và **chỉ khi quản trị viên xác nhận** mới
đánh dấu đoạn đường nguy hiểm lên bản đồ chung (luồng duyệt này đã có từ 15.16).
- **Migration `gis/11-hazard-reports-dedupe.sql`** (đã chạy trên Supabase 2026-10-05, 1 transaction, chỉ thêm
  mới): cột `hazard_reports.duplicate_of` (FK tự tham chiếu, `ON DELETE SET NULL`) + index một phần.
- **Camera bắt buộc, chụp trực tiếp**: `components/report/CameraCapture.vue` dùng `getUserMedia` (ưu tiên camera
  sau, `audio:false`), CỐ Ý không có `<input type=file>` và không dùng thuộc tính `capture` (đó chỉ là gợi ý,
  nhiều trình duyệt vẫn cho chọn ảnh trong thư viện). Nút chụp chỉ bật sau khung hình đầu tiên; chụp xong tắt
  camera ngay; tự tắt khi đổi tab. Lỗi được phân loại ở `utils/camera.ts` (từ chối quyền / không có camera /
  đang bị app khác dùng / không phải ngữ cảnh bảo mật). Vị trí GPS được **lấy lại ngay lúc bấm chụp**. Backend
  nay **bắt buộc có ảnh** (400 nếu thiếu).
  ⚠️ **Giới hạn trung thực**: server không phân biệt được ảnh chụp trực tiếp hay tải lên — ai gọi thẳng API vẫn gửi
  được ảnh bất kỳ. Ràng buộc camera tăng độ tin cậy với người dùng bình thường, KHÔNG thay bước commander xác
  minh. Camera chỉ chạy trên HTTPS hoặc localhost: demo qua ngrok được, mở bằng `http://192.168.x.x` thì không.
- **Thông báo realtime cho quản trị viên**: 2 sự kiện socket mới `hazard-report:new` / `hazard-report:reviewed`,
  chỉ bắn vào room `province:lamdong` (commander) — tên/SĐT người báo và vị trí không đi tới dân/cứu hộ. Dashboard:
  toast, tab "Báo cáo chờ duyệt" nhấp nháy khi đang ở tab khác (KHÔNG tự chuyển tab — đang xử lý SOS thì không bị
  giật sang chỗ khác), `(N)` ở tiêu đề tab trình duyệt, hàng đợi tự làm mới chạy nền. Kiểu dữ liệu ở
  `shared/socket-events.types.ts` — nhớ sửa đủ **3 bản** (`shared/`, `backend/src/common/`, `frontend/src/shared/`).
- **Gộp báo cáo trùng**: cùng `type`, ≤ 100 m (`DUPLICATE_RADIUS_M`), so với báo cáo CHỜ DUYỆT cũ nhất chưa bị
  gộp. Việc chọn báo cáo chính nằm **ngay trong câu `INSERT ... SELECT`** (không tra cứu rồi mới chèn) để thu hẹp
  khe hở đua giữa 2 người gửi cùng lúc. Duyệt/từ chối báo cáo chính áp dụng cho cả nhóm; thao tác trực tiếp lên
  báo cáo đã gộp → 409. Báo cáo "mồ côi" (báo cáo chính đã đổi trạng thái) vẫn hiện thành mục riêng để không bị
  bỏ sót. Một người không tự gộp vào chính mình (409). Người gửi được báo "đã gộp, N người cùng báo".
- **Lịch sử**: `ReportModerationPanel.vue` có bộ lọc Chờ duyệt / Đã duyệt / Từ chối, phân trang (`limit` ≤ 100,
  `offset`); mục lịch sử cho biết người duyệt, ghi chú, mức Đỏ/Vàng, cảnh báo còn hoạt động hay đã gỡ. Người báo
  xem được trạng thái + ghi chú của quản trị viên ở "Báo cáo của tôi". API: `docs/api-contract.md` Mục 3.
- **Kiểm chứng**: BE 123 test / 12 suite (thêm: gộp/không gộp, cascade duyệt-từ chối, 409 báo cáo đã gộp, tự báo
  trùng, phân trang, gateway chỉ bắn vào room commander), FE 55 test (từ 47: thêm 8 test của `camera.spec.ts`);
  eslint + tsc/vue-tsc + build sạch. E2E qua HTTP + socket.io-client: 37 kiểm tra đạt. Giao diện thật trong trình
  duyệt (2 tab: commander + nạn nhân giả lập 375×812, giả lập `getUserMedia`/`getCurrentPosition`): GPS lỗi → khoá
  gửi; camera bị từ chối → hướng dẫn cấp quyền, vẫn không gửi được; chụp → xem trước + camera tắt + GPS lấy lại;
  chụp lại; gửi → tab commander nhận toast + nhấp nháy + `(1)` ở tiêu đề; nhóm 2 người → 1 mục với 2 ảnh; duyệt
  cả nhóm (Vàng) → icon vàng + mục lịch sử đúng; từ chối cả nhóm / từ chối đơn → mục "Từ chối"; người báo thấy ghi chú.
- **Bài học test**: (1) `App.vue` bọc `RouterView` trong `<transition mode="out-in">` — khi khung trình duyệt bị
  ẩn, `requestAnimationFrame` không chạy nên chuyển cảnh SPA treo ở trang cũ (URL đã đổi nhưng DOM chưa); khi test
  hãy tải thẳng URL thay vì bấm link. (2) Mỗi truy vấn Supabase từ xa ~350 ms, duyệt cả nhóm mất 3–4 s — đọc DOM
  ngay sau khi bấm sẽ thấy trạng thái cũ, phải chờ trạng thái đổi chứ đừng chờ một khoảng cố định.
- **Còn nợ / giới hạn**:
  - [ ] **Chưa thử camera thật trên điện thoại** (mới giả lập `getUserMedia` bằng canvas). Cần thử iPhone Safari và
    Chrome Android qua HTTPS (ngrok): cấp/từ chối quyền, camera sau, xoay màn hình, trình duyệt trong Zalo/Facebook.
  - [ ] Thông báo realtime chỉ có khi **Dashboard đang mở** (không có push/âm thanh/Notification API; các trang
    commander khác như /users, /stats không nghe sự kiện). Commander đóng tab thì chỉ thấy khi mở lại Dashboard.
  - [ ] Chưa có hộp xác nhận khi "Duyệt/Từ chối cả nhóm" — bấm nhầm tác động tới cả N người báo, và chưa có thao
    tác hoàn tác (chỉ sửa được bằng SQL).
  - [ ] Bán kính gộp 100 m là hằng số, chưa cấu hình được; 2 điểm sạt khác nhau cùng loại cách < 100 m sẽ bị gộp.
  - [ ] Danh sách báo cáo chạy 2 truy vấn tuần tự (~1 s với Supabase từ xa, lần đầu ~3 s do kết nối nguội); nếu
    chậm khi triển khai thật thì gộp truy vấn "báo cáo đã gộp" vào truy vấn chính.
  - [ ] **Dữ liệu thử còn lại trong DB thật** (đếm 2026-10-05): 17 dòng `hazard_reports` (7 đã duyệt, 10 từ chối;
    TOÀN BỘ là dữ liệu thử, mô tả chứa "E2E"/"UI-TEST"), trong đó 4 dòng đứng tên 1 tài khoản người dùng thật
    của nhóm (đã ẩn tên + số điện thoại trong tài liệu này); 30 dòng `road_hazards` đã gỡ. Chưa xoá vì xoá dữ liệu trên DB thật cần Quang đồng ý.
  - [ ] **2 cảnh báo ĐỎ đang hoạt động không phải do bài test này tạo** — `aae9a47c…` ("Sạt lở taluy, đá lăn xuống
    đường (demo)", r=300 m, ward 24805) và `44eb9f44…` ("Điểm Sạt lở", r=200 m, ward 24781, tạo 15:03 bởi tài
    khoản Admin Local). Cảnh báo đỏ làm tuyến đi né và ảnh hưởng chọn đội tự động (Mục 15.14.1): nếu là dữ liệu
    thử thì gỡ ở Dashboard → "Cảnh báo/chặn đường" → "Gỡ cảnh báo".
  - ℹ️ Phát hiện ngoài phạm vi (đã tách thành việc riêng, chưa sửa): `MapView.vue` (dòng ~296, ~321) gọi
    `GET /api/rescue-teams` cho cả nạn nhân → 403 + toast "Không có quyền truy cập" mỗi lần mở `/map`.

### 15.16 Báo cáo cộng đồng (crowdsourcing) + cảnh báo đỏ/vàng (2026-10-05)

Yêu cầu: người dân/tình nguyện viên báo sạt lở từ điện thoại — tự lấy GPS, đính kèm ảnh, lưu "Chờ duyệt",
quản trị viên xác minh rồi mới hiện icon đỏ/vàng lên bản đồ chung.
- **Migration `gis/10-hazard-reports-and-severity.sql`** (đã chạy trên Supabase 2026-10-05, trong 1 transaction,
  chỉ thêm mới): bảng `hazard_reports` (ảnh `BYTEA` + `image_mime`, `accuracy_m`, `status`
  pending/approved/rejected, `reviewed_by/at`, `hazard_id`, `ward_code` qua trigger) và cột
  `road_hazards.severity` (`blocked` = ĐỎ mặc định, `caution` = VÀNG).
- **Đỏ/vàng = mức độ**: đỏ chặn đường (vào `avoid_polygons`, tuyến đi né); vàng chỉ hiển thị, `findActiveAvoidPolygons`
  lọc `severity='blocked'` nên vàng KHÔNG làm tuyến đi vòng. Cảnh báo cũ tự thành đỏ.
- **Backend** `backend/src/hazard-reports/`: `POST /api/hazard-reports` (multipart, mọi role đăng nhập; 10/giờ/user,
  tối đa 5 báo cáo chờ duyệt, toạ độ ngoài tỉnh bị chặn), `GET /mine`, `GET ?status=` (commander), `GET /:id/image`
  (commander hoặc chủ báo cáo), `PATCH /:id/approve|reject` (commander). Duyệt = `UPDATE ... WHERE status='pending'`
  "chiếm" báo cáo trước rồi mới tạo cảnh báo (2 commander bấm cùng lúc không sinh trùng; lỗi tạo cảnh báo thì trả về
  pending). Chi tiết: `docs/api-contract.md` Mục 3.
- **Ảnh**: nén ở trình duyệt (cạnh dài ≤1280px, JPEG q0.75, đồng thời bỏ EXIF) → backend kiểm **magic bytes**
  (không tin Content-Type), chỉ JPEG/PNG/WebP ≤2MB; SVG/HTML giả danh ảnh bị 400. Lưu thẳng DB (không cần dịch vụ lưu
  trữ, không mất khi deploy lại) và chỉ đọc qua `GET /:id/image` có phân quyền (không SELECT trong danh sách).
- **Frontend**: `/report` (`ReportView.vue`, mobile-first): vị trí lấy tự động bằng Geolocation (không cho gõ tay),
  **không gửi được khi GPS thất bại** (khác SOS: toạ độ giả tâm tỉnh sẽ đặt cảnh báo sai chỗ trên bản đồ chung),
  GPS kém (>100 m) vẫn gửi nhưng gắn cờ; chọn loại, mô tả, ảnh (từ Mục 15.17: BẮT BUỘC, chỉ chụp trực tiếp bằng camera, không chọn ảnh có sẵn); "Báo cáo của tôi" kèm trạng thái.
  Lối vào: nút nổi "Báo cáo sạt lở / chặn đường" trên `/map` (đã đăng nhập) + nút ở header RescuerView.
  Dashboard commander: tab thứ 3 "Báo cáo chờ duyệt" (xem ảnh, người báo, GPS ±m; chọn Đỏ/Vàng + bán kính; Duyệt /
  Từ chối), điểm "?" vàng nét đứt trên bản đồ CHỈ commander thấy; form tạo cảnh báo trực tiếp cũng có chọn mức độ.
  Bản đồ chung `/map` (đã đăng nhập) vẽ cảnh báo đã duyệt: vòng tròn + icon "!" đỏ/vàng.
- **Kiểm chứng**: BE 112 test (thêm 22: kiểm ảnh, duyệt/từ chối/chống trùng, phân quyền ảnh, vàng không vào
  avoid_polygons), FE 47 test, lint/build sạch. E2E qua HTTP thật (28 kiểm tra đạt): 401 khi chưa đăng nhập, ngoài
  tỉnh/SVG giả ảnh/loại sai → 400, báo cáo chờ duyệt KHÔNG lọt vào `/api/hazards`, người dân không xem được hàng đợi
  hay tự duyệt (403), ảnh chỉ chủ + commander xem được, duyệt VÀNG → hiện nhưng tuyến 3253 m không đổi, duyệt ĐỎ →
  tuyến né (cách tâm 890 m > 200 m), duyệt lần 2 → 409, từ chối → không hiện. Giao diện thật (trình duyệt, giả lập
  GPS + chọn ảnh 3000×2000): form điện thoại, gửi → "Chờ duyệt", commander duyệt vàng → icon vàng, đếm tab đúng.
- **2 lỗi chỉ lộ ra khi test giao diện thật (test API không thấy)**: (1) `services/http.ts` đặt sẵn
  `Content-Type: application/json` nên axios biến `FormData` thành JSON → ảnh mất, server báo "property image should not
  exist" — request upload phải ghi đè `multipart/form-data`; (2) `ref<Blob>` bọc Blob thành Proxy reactive, `FormData`
  không nhận ra → dùng `shallowRef`. Bài học: upload file luôn phải test qua trình duyệt, không chỉ script.
- **Còn nợ / giới hạn**: [x] chưa có thông báo realtime cho commander khi có báo cáo mới — **Đã xử lý
  (2026-10-05), Mục 15.17** (không dùng `notification:system` mà thêm 2 sự kiện riêng `hazard-report:*`);
  [x] chưa chống báo cáo trùng — **Đã xử lý, Mục 15.17**; [x] báo cáo đã duyệt/bị từ chối chưa có tab lịch sử
  trên Dashboard — **Đã xử lý, Mục 15.17**; [ ] chưa chạy trên điện thoại thật (mới giả lập GPS/camera, xem 15.17).

### 15.15 Việc "admin" thứ 4/4 (2026-10-05) — Hệ thống & nhật ký + health check

Quang chọn hiểu "cấu hình hệ thống, xem log" là **xem trạng thái + nhật ký, CHỈ ĐỌC**: cấu hình thật
là biến môi trường (`.env`) của máy chủ nên sửa qua web vừa vô nghĩa (cần restart) vừa nguy hiểm
(lộ/ghi đè secret). Trang hiển thị key nào đã cấu hình (boolean), không bao giờ giá trị.
- Backend `backend/src/system/`: `GET /api/health` (công khai, **đóng nợ Mục 15.5** — Render có
  endpoint kiểm tra sống; DB lỗi → 200 `degraded`, không throw), `GET /api/system/status`,
  `GET /api/system/activity` (commander). Nhật ký gộp `sos_timeline` + `road_hazards` — không tạo bảng audit mới.
- Frontend: `SystemView.vue` route `/system`, link "Hệ thống" ở header Dashboard.
- Kiểm chứng: `system.service.spec.ts` (6 test, gồm test "không lộ key/secret"), tổng 81 test BE + 41 FE
  pass, build/eslint sạch; gọi thật: health 200, status/activity đúng số liệu DB thật, không token → 401;
  trình duyệt `/system` hiện đúng DB 356 ms, ORS/eSMS đã cấu hình, nhật ký thật.
- Phát hiện: **`ESMS_BRANDNAME` đang trống** → `ESMS_SMS_TYPE=2` sẽ báo lỗi `CodeResult=104` (xem Mục 9) —
  SMS dự phòng chưa thực sự gửi được cho tới khi đăng ký Brandname với eSMS.

---

*Phiên bản: 2.13.1 — Cập nhật: 2026-10-06 (thêm Mục 15.18 — link Google Maps trên màn hình rescuer chỉ hiện khi đường bộ trong app không dùng được; ghi lại kết quả đo: tuyến ORS mặc định là tuyến NHANH nhất, không phải ngắn nhất theo km)*
*Phiên bản: 2.13.0 — Cập nhật: 2026-10-05 (thêm Mục 15.17 — báo cáo cộng đồng: camera bắt buộc chụp trực tiếp, thông báo realtime cho commander qua socket `hazard-report:*`, gộp báo cáo trùng trong 100 m, tab lịch sử đã duyệt/từ chối; migration `gis/11-hazard-reports-dedupe.sql`)*
*Phiên bản: 2.12.0 — Cập nhật: 2026-09-25 (thêm Mục 15.14 — Quản lý cảnh báo/chặn đường: bảng road_hazards, HazardsModule, tích hợp avoid_polygons vào RoutingService, UI đánh dấu trên DashboardView + xem read-only ở RescuerView; hoàn thiện luôn Thống kê tổng quan — StatsView.vue, route /stats)*
*Phiên bản: 2.11.1 — Cập nhật: 2026-09-22 (Mục 15.13 bổ sung: chặn `/api/routing/route` cho toạ độ ngoài tỉnh Lâm Đồng bằng `wards.boundary` sẵn có, không cần file ranh giới riêng)*
*Phiên bản: 2.11.0 — Cập nhật: 2026-09-22 (thêm Mục 15.13 — dẫn đường thật trên bản đồ RescuerView, thay cho đường chim bay + Google Maps ở Mục 15.9; đổi hướng trong cùng phiên từ tự host GraphHopper/Oracle VM sang gọi thẳng OpenRouteService free tier, không cần quản lý server)*
*Phiên bản: 2.10.0 — Cập nhật: 2026-09-13 (thêm Mục 15.12 — GPS SOS lệch do thiếu enableHighAccuracy; tile z7 trỏ vào thư mục offline không tồn tại; Viettel chặn DNS openstreetmap.org → thử openstreetmap.de (404 ở z18) → chốt openstreetmap.fr/hot)*
*Phiên bản: 2.9.0 — Cập nhật: 2026-09-12 (Mục 15.11 thêm Fix #2 — victim thấy đội cứu hộ được giao đang tới, dùng poll 20s sẵn có thay vì socket mới)*
*Phiên bản: 2.8.0 — Cập nhật: 2026-09-12 (thêm Mục 15.11 — fix marker đội cứu hộ không di chuyển trên dashboard commander + bug TypeORM UPDATE...RETURNING trả tuple khiến PATCH location/status đội cứu hộ luôn 500; xác nhận + sửa cùng bug ở sos.service.ts: cancel/assign/updateStatus, mock test sửa đúng hình dạng driver)*
*Phiên bản: 2.7.0 — Cập nhật: 2026-09-11 (thêm Mục 15.10 — fix leader không thấy nhiệm vụ auto-assign ở xã khác; đánh dấu xong F-GIS-01 ở Mục 15.9 — mở rộng bán kính 10km→20km)*
*Phiên bản: 2.6.0 — Cập nhật: 2026-09-10 (thêm Mục 15.9 — audit đối chiếu SRS ↔ code thật: liệt kê checklist thiếu/lệch, chưa sửa code)*
*Phiên bản: 2.5.0 — Cập nhật: 2026-09-09 (thêm Mục 15.8 — fix "vỡ hình"/lag khi zoom: simplify ranh giới bằng mapshaper + ẩn ở zoom sâu, long task 684ms → 0ms)*
*Phiên bản: 2.4.0 — Cập nhật: 2026-09-08 (thêm Mục 15.7 — điều tra bản đồ trắng khi zoom: nguyên nhân gốc ở tile/service worker, KHÔNG phải CSS; kịch bản sửa + tiêu chí nghiệm thu, chưa sửa code)*
*Phiên bản: 2.3.0 — Cập nhật: 2026-09-06 (Mục 15.4/15.6 — fix đăng xuất khi F5, SOS active/offline-queue mất sau F5, leo thang đặc quyền qua register, GPS fallback âm thầm gửi toạ độ giả)*
*Phiên bản: 2.2.0 — Cập nhật: 2026-09-05 (thêm Mục 15 — checklist audit bảo mật/tooling/tài liệu, phát hiện qua rà code thật)*
*Phiên bản: 2.1.0 — Cập nhật: 2026-08-24 (chuyển district_code → ward_code sau sáp nhập hành chính 2025)*
*Tích hợp AI Skills từ: PatrickJS/awesome-cursorrules · Kadajett/agent-nestjs-skills · j4flmao/agent_skills_nodejs_nestjs · BehiSecc/awesome-claude-skills · Anthropic official skills*

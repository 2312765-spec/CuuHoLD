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


**⚠️ Hai điều người sau PHẢI biết:**
- **Guard "đếm số feature" sau simplify gần như vô dụng.** Kiểm chứng thật: chạy `SAI_SO_MET=20000` (20 km, hình méo hoàn toàn) **vẫn ra đủ 123 đơn vị và vẫn pass** — vì cờ `keep-shapes` giữ mọi polygon. Guard **thật sự** có tác dụng là kiểm **lệch diện tích từng xã < 12%** (đã kiểm chứng chặn đúng ở `SAI_SO_MET=200`, báo xã Phú Quý lệch 31.89%). Đừng tin kiểm đếm feature là đủ.
- **`mapshaper` kéo theo 209 gói và 5 vulnerability mới** (`@ngageoint/geopackage`, `adm-zip`, `image-size`, `file-type`, `fflate` — đều từ phần hỗ trợ GeoPackage/zip không dùng tới). Chấp nhận có chủ đích: `devDependency`, không vào bundle trình duyệt, chạy lúc build trên dữ liệu từ nguồn đã biết. Nếu team muốn gỡ, phải tìm thư viện khác **có dựng topology** — không được thay bằng `turf`/`simplify-js`.

**Không ảnh hưởng nghiệp vụ:** file geojson chỉ để hiển thị. `ward_code` của mỗi SOS do trigger `ST_Contains` ở backend suy ra từ bảng `wards` (sinh riêng bởi `gis/02-seed-wards.sql`, **giữ nguyên độ chính xác gốc**, không simplify); điều đội thì `findNearestTeams()` tính theo khoảng cách GPS thật, không theo ranh giới xã. Ở vĩ độ Lâm Đồng 1 pixel ≈ 18.7m tại zoom 13, nên sai số 25m luôn **dưới 1.3 pixel** ở mọi mức zoom mà ranh giới còn hiển thị.

---

*Phiên bản: 2.5.0 — Cập nhật: 2026-09-09 (thêm Mục 15.8 — fix "vỡ hình"/lag khi zoom: simplify ranh giới bằng mapshaper + ẩn ở zoom sâu, long task 684ms → 0ms)*
*Phiên bản: 2.4.0 — Cập nhật: 2026-09-08 (thêm Mục 15.7 — điều tra bản đồ trắng khi zoom: nguyên nhân gốc ở tile/service worker, KHÔNG phải CSS; kịch bản sửa + tiêu chí nghiệm thu, chưa sửa code)*
*Phiên bản: 2.3.0 — Cập nhật: 2026-09-06 (Mục 15.4/15.6 — fix đăng xuất khi F5, SOS active/offline-queue mất sau F5, leo thang đặc quyền qua register, GPS fallback âm thầm gửi toạ độ giả)*
*Phiên bản: 2.2.0 — Cập nhật: 2026-09-05 (thêm Mục 15 — checklist audit bảo mật/tooling/tài liệu, phát hiện qua rà code thật)*
*Phiên bản: 2.1.0 — Cập nhật: 2026-08-24 (chuyển district_code → ward_code sau sáp nhập hành chính 2025)*
*Tích hợp AI Skills từ: PatrickJS/awesome-cursorrules · Kadajett/agent-nestjs-skills · j4flmao/agent_skills_nodejs_nestjs · BehiSecc/awesome-claude-skills · Anthropic official skills*

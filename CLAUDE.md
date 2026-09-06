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
│   ├── 02-seed-wards.sql               ← 123 xã/phường Lâm Đồng mới (sau sáp nhập 2025)
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
        └── lamdong-wards.geojson      ← Ranh giới xã/phường (không dùng GADM cũ —
                                           đã lỗi thời sau sáp nhập 2025, xem
                                           gis/02-seed-wards.sql cho nguồn dữ liệu)
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

### 15.5 Vận hành
- [ ] **Chưa có health-check endpoint** (`GET /api/health`). Deploy lên Render.com (Mục 2) mà thiếu endpoint này thì platform không có cách xác định server còn sống hay đã treo để tự restart.
- [ ] **`frontend/.env` bị root `.gitignore` (`**/.env`) chặn**, trong khi comment ở `frontend/.gitignore` khẳng định ngược lại ("không phải secret, commit để cả nhóm dùng chung cấu hình chuẩn"). Hai file `.gitignore` đang mâu thuẫn — cần thêm exception `!frontend/.env` ở root hoặc sửa lại comment sai.
- [ ] **Trước khi coi một phiên làm việc là "xong": luôn chạy `git status` ở cả `backend/` và `frontend/`.** Từng xảy ra thật: toàn bộ `frontend/` chưa commit lần nào dù đã có nhiều tính năng hoàn chỉnh — dễ mất việc nếu máy hỏng/branch bị xoá nhầm.

---

*Phiên bản: 2.2.0 — Cập nhật: 2026-09-05 (thêm Mục 15 — checklist audit bảo mật/tooling/tài liệu, phát hiện qua rà code thật)*
*Phiên bản: 2.1.0 — Cập nhật: 2026-08-24 (chuyển district_code → ward_code sau sáp nhập hành chính 2025)*
*Tích hợp AI Skills từ: PatrickJS/awesome-cursorrules · Kadajett/agent-nestjs-skills · j4flmao/agent_skills_nodejs_nestjs · BehiSecc/awesome-claude-skills · Anthropic official skills*

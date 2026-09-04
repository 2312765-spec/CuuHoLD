# Checklist tích hợp Frontend (WebCuuHo) với Backend hiện tại

> Nguồn: phân tích repo `github.com/hqt-7105/WebCuuHo` (thư mục `vue-project/`) đối chiếu
> với `backend/src` + `shared/socket-events.types.ts` hiện tại. Xem `docs/api-contract.md`
> cho response shape chi tiết từng endpoint.
>
> **Thứ tự làm:** Phase 1 → 2 → 3 → 4 → 5 → 6. Ranh giới xã/phường (GeoJSON tĩnh, Phase 0)
> có thể làm song song bất kỳ lúc nào vì không phụ thuộc các phase còn lại.

---

## Phase 0 — Chuẩn bị (làm được ngay, song song)

- [ ] Xoá phụ thuộc vào `socket-test-server/` (chỉ là mock, không cần nữa).
- [ ] Sửa `vue-project/.env`:
  ```env
  VITE_API_BASE_URL=http://localhost:3000/api
  VITE_SOCKET_URL=http://localhost:3000
  ```
  (Socket.io gateway chạy chung port HTTP là 3000, không phải 4000 của mock server.)
- [ ] Copy `public/data/lamdong-wards.geojson` vào frontend, load ranh giới xã/phường
      **tĩnh** bằng `L.geoJSON()` — KHÔNG gọi API `/ranhgioi` (backend không có endpoint này).

---

## Phase 1 — Đồng bộ type & endpoint (nền tảng, làm trước tiên)

- [ ] **`src/config.ts`** — sửa `endpoints`, xoá `ranhgioi`/`diemCuuTro`/`baoCaoSuCo`:
  ```ts
  endpoints: {
    auth: '/auth',
    sos: '/sos',
    gisNearestTeams: '/gis/nearest-teams',
    gisSosHeatmap: '/gis/sos-heatmap',
    rescueTeams: '/rescue-teams'
  }
  ```

- [ ] **`src/types/index.ts`** — xoá `DiemCuuTro`/`BaoCaoSuCo`, thay bằng type khớp entity
      backend. Re-export enum từ `shared/socket-events.types.ts`, không định nghĩa lại:
  ```ts
  export type { SosType, SosStatus, UserRole } from '../../shared/socket-events.types'

  export interface SosRequest {
    id: string
    victimId: string
    type: SosType
    status: SosStatus
    lat: number
    lng: number
    wardCode: string
    description: string | null
    assignedTeamId: string | null
    cancelDeadline: string
    createdAt: string
  }

  export interface RescueTeam {
    id: string
    name: string
    wardCode: string
    specialties: string[]
    lat: number
    lng: number
    status: 'available' | 'busy' | 'offline'
  }
  ```

- [ ] **`src/types/socket.ts`** — dùng đúng event name + payload từ shared, xoá `bao-cao:moi`:
  ```ts
  import type {
    SosNewPayload, SosUpdatedPayload,
    TeamLocationPayload, SystemNotificationPayload
  } from '../../shared/socket-events.types'

  export interface ServerToClientEvents {
    'sos:new': (data: SosNewPayload) => void
    'sos:updated': (data: SosUpdatedPayload) => void
    'team:location-updated': (data: TeamLocationPayload) => void
    'notification:system': (data: SystemNotificationPayload) => void
  }

  export interface ClientToServerEvents {
    'team:update-location': (data: { teamId: string; lat: number; lng: number }) => void
    'sos:victim-cancel': (data: { sosId: string }) => void
    'commander:assign-team': (data: { sosId: string; teamId: string }) => void
    'rescuer:update-status': (data: { sosId: string; status: string }) => void
  }
  ```

---

## Phase 2 — Thêm tầng Auth (hiện chưa có gì cả)

- [ ] **`src/types/auth.ts`** (mới):
  ```ts
  export interface User { id: string; phone: string; name: string; role: UserRole; wardCode: string }
  export interface LoginResponse { accessToken: string; refreshToken: string; user: User }
  ```

- [ ] **`src/services/auth.service.ts`** (mới):
  ```ts
  export async function login(phone: string, password: string) {
    const { data } = await http.post(CONFIG.endpoints.auth + '/login', { phone, password })
    return data.data as LoginResponse
  }
  export async function getMe() {
    const { data } = await http.get(CONFIG.endpoints.auth + '/me')
    return data.data as User
  }
  ```

- [ ] **`src/stores/auth.store.ts`** (mới, Pinia) — lưu `accessToken`, state `user`,
      action `login()` / `logout()`.

- [ ] **`src/services/http.ts`** — thêm request interceptor gắn Bearer token:
  ```ts
  http.interceptors.request.use((config) => {
    const token = useAuthStore().accessToken
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  ```

- [ ] **`src/router/index.ts`** — thêm `LoginView`, `beforeEach` guard check
      `authStore.user`, redirect theo role: `victim` → HomeView, `rescuer` → RescuerView,
      `commander` → DashboardView (2 view sau chưa tồn tại, tạo mới ở Phase 5).

---

## Phase 3 — Sửa services gọi API cho khớp response shape thật

> Backend trả `{ success, data, message }` — mọi service phải unwrap `.data.data`.

- [ ] **`src/services/sosService.ts`** (thay `baoCaoService.ts`):
  ```ts
  export async function guiSos(payload: { lat: number; lng: number; type: SosType }) {
    const { data } = await http.post(CONFIG.endpoints.sos, payload)
    return data.data as SosRequest
  }
  export async function huySos(id: string) {
    const { data } = await http.patch(`${CONFIG.endpoints.sos}/${id}/cancel`, {})
    return data.data
  }
  ```

- [ ] **`src/services/rescueTeamsService.ts`** (thay `diemCuuTroService.ts`):
  ```ts
  export async function fetchRescueTeams() {
    const { data } = await http.get(CONFIG.endpoints.rescueTeams)
    return data.data as RescueTeam[]
  }
  ```

---

## Phase 4 — Socket

- [ ] **`src/composables/useSocket.ts`** — gắn JWT khi connect (backend `handleConnection()`
      verify JWT, disconnect ngay nếu sai — CLAUDE.md Mục 8), lắng nghe đúng event thật:
  ```ts
  socket = io(url, {
    auth: { token: useAuthStore().accessToken },
    reconnectionAttempts: 5,
    timeout: 4000
  })
  socket.on('sos:new', (data) => handlers.onSosNew?.(data))
  socket.on('sos:updated', (data) => handlers.onSosUpdated?.(data))
  ```

---

## Phase 5 — Store & UI theo role

- [ ] **`src/stores/mapData.ts`** — đổi tên state (`diemCuuTro`→`rescueTeams`,
      `baoCaoSuCo`→`sosRequests`), bỏ mảng hard-code Đà Lạt/Bảo Lộc làm nguồn thật
      (có thể giữ làm fallback dev), action `taiDiemCuuTroTuServer` → gọi `fetchRescueTeams()`.

- [ ] Tạo view/component còn thiếu (theo CLAUDE.md Mục 5):
  - [ ] `views/AuthView.vue`
  - [ ] `views/RescuerView.vue`
  - [ ] `views/DashboardView.vue`
  - [ ] `components/sos/SosButton.vue` + `SosConfirmDialog.vue` (countdown 5s trước khi gửi)
  - [ ] Logic hủy SOS trong 3 phút (`cancelDeadline`): hiển thị countdown, disable/nhắc phạt
        sau khi qua deadline.

---

## Phase 6 — Kiểm thử tích hợp

- [ ] Chạy `backend` (`npm run start:dev`, port 3000) + `frontend` (`npm run dev`).
- [ ] Login bằng tài khoản demo (CLAUDE.md Mục 12) → xác nhận token lưu, header
      `Authorization` xuất hiện trong Network tab.
- [ ] Victim gửi SOS → xác nhận `sos:new` nhận được ở phía commander (2 tab, 2 role).
- [ ] Test rate limit (5 SOS/giờ/user) và cancel-penalty logic khớp `sos.service.ts`
      phía backend.
- [ ] Test ranh giới xã/phường (Phase 0) hiển thị đúng, không gọi API nào.

---

*Checklist này dựa trên trạng thái repo `WebCuuHo` và `backend/src` tại thời điểm phân
tích — nếu backend hoặc frontend đổi cấu trúc, cần đọc lại code trước khi áp dụng.*

// Tải trước mã JS của các trang mà vai trò hiện tại hay chuyển qua lại, lúc trình duyệt rảnh.
// Trước đây mỗi trang chỉ được tải khi bấm vào → lần đầu mở Thống kê/Người dùng/Hệ thống phải
// chờ tải (chậm rõ ở `npm run dev`, nơi Vite còn phải dịch file ngay lúc đó). Dùng CÙNG hàm
// import() với router/index.ts nên Vite gộp về đúng một chunk, không tải hai lần.
import type { UserRole } from '@/shared/socket-events.types'

export const trang = {
  map: () => import('@/views/MapView.vue'),
  hoSo: () => import('@/views/HoSoView.vue'),
  lichSu: () => import('@/views/LichSuSosView.vue'),
  rescuer: () => import('@/views/RescuerView.vue'),
  dashboard: () => import('@/views/DashboardView.vue'),
  users: () => import('@/views/UsersView.vue'),
  report: () => import('@/views/ReportView.vue'),
  system: () => import('@/views/SystemView.vue'),
  stats: () => import('@/views/StatsView.vue')
}

type TaiTrang = () => Promise<unknown>

const THEO_VAI_TRO: Record<UserRole | 'khach', TaiTrang[]> = {
  commander: [trang.dashboard, trang.stats, trang.users, trang.system, trang.map, trang.hoSo],
  rescuer: [trang.rescuer, trang.map, trang.report, trang.hoSo],
  victim: [trang.map, trang.report, trang.hoSo, trang.lichSu],
  khach: [trang.map]
}

const daTai = new Set<TaiTrang>()

function khiRanh(viec: () => void): void {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (ric) ric(viec, { timeout: 3000 })
  else setTimeout(viec, 1500)
}

// Gọi sau mỗi lần chuyển trang; trang đã tải trước rồi thì bỏ qua. Lỗi mạng thì im lặng —
// đây chỉ là tăng tốc, bấm vào trang đó vẫn tải bình thường (và có xử lý lỗi riêng).
export function taiTruocTheoVaiTro(vaiTro: UserRole | null | undefined): void {
  const ds = THEO_VAI_TRO[vaiTro ?? 'khach'].filter((t) => !daTai.has(t))
  if (ds.length === 0) return
  khiRanh(() => {
    for (const t of ds) {
      daTai.add(t)
      t().catch(() => daTai.delete(t))
    }
  })
}

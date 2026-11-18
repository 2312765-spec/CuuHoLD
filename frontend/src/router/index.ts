import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/shared/socket-events.types'
import { xuLyLoiTaiTrang } from './taiLaiKhiLoiTaiTrang'
import { coLichSuSos } from '@/constants/tinhNangBackend'
import { trang, taiTruocTheoVaiTro } from './taiTruocTrang'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    // /map xem được không cần đăng nhập — chỉ hành động gửi SOS mới cần login (nhắc qua modal).
    { path: '/map', name: 'map', component: trang.map },
    // Khu vực rescuer/commander vẫn bắt buộc đăng nhập đúng vai trò.
    // F-UI-01 — hồ sơ cá nhân + đổi mật khẩu, mọi role đã đăng nhập.
    {
      path: '/ho-so',
      name: 'ho-so',
      component: trang.hoSo,
      meta: { requiresAuth: true }
    },
    // F-UI-02 — lịch sử SOS cá nhân, chỉ victim (người gửi SOS). Backend chưa có
    // GET /api/sos/mine/history → tắt mặc định, vào thẳng /lich-su thì về bản đồ.
    {
      path: '/lich-su',
      name: 'lich-su',
      component: trang.lichSu,
      meta: { requiresAuth: true, roles: ['victim'] as UserRole[] },
      beforeEnter: () => (coLichSuSos() ? true : { name: 'map' })
    },
    {
      path: '/rescuer',
      name: 'rescuer',
      component: trang.rescuer,
      meta: { requiresAuth: true, roles: ['rescuer'] as UserRole[] }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: trang.dashboard,
      meta: { requiresAuth: true, roles: ['commander'] as UserRole[] }
    },
    {
      path: '/users',
      name: 'users',
      component: trang.users,
      meta: { requiresAuth: true, roles: ['commander'] as UserRole[] }
    },
    {
      // Mọi vai trò đã đăng nhập đều báo cáo được (người dân, tình nguyện viên/cứu hộ, chỉ huy).
      path: '/report',
      name: 'report',
      component: trang.report,
      meta: { requiresAuth: true }
    },
    {
      path: '/system',
      name: 'system',
      component: trang.system,
      meta: { requiresAuth: true, roles: ['commander'] as UserRole[] }
    },
    {
      path: '/stats',
      name: 'stats',
      component: trang.stats,
      meta: { requiresAuth: true, roles: ['commander'] as UserRole[] }
    }
  ]
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    // Chưa đăng nhập mà vào khu vực cần quyền → về trang chủ (cổng vào duy nhất) kèm
    // ?auth=1 để HomeView tự bật sẵn modal đăng nhập, khỏi bắt người dùng tự mò nút.
    return { name: 'home', query: { auth: '1' } }
  }
  const roles = to.meta.roles as UserRole[] | undefined
  if (roles && authStore.role && !roles.includes(authStore.role)) {
    if (authStore.role === 'rescuer') return { name: 'rescuer' }
    if (authStore.role === 'commander') return { name: 'dashboard' }
    return { name: 'home' }
  }
  return true
})

// Sau mỗi lần chuyển trang, tải trước (lúc rảnh) các trang vai trò này hay mở — xem taiTruocTrang.ts.
router.afterEach(() => taiTruocTheoVaiTro(useAuthStore().role))

// Tải file JS của trang thất bại → tự tải lại toàn trang tới đúng địa chỉ (xem file dưới).
router.onError((loi, to) => xuLyLoiTaiTrang(loi, to.fullPath))

export default router
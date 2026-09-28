import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/shared/socket-events.types'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    // /map xem được không cần đăng nhập — chỉ hành động gửi SOS mới cần login (nhắc qua modal).
    { path: '/map', name: 'map', component: () => import('@/views/MapView.vue') },
    // Khu vực rescuer/commander vẫn bắt buộc đăng nhập đúng vai trò.
    // F-UI-01 — hồ sơ cá nhân + đổi mật khẩu, mọi role đã đăng nhập.
    {
      path: '/ho-so',
      name: 'ho-so',
      component: () => import('@/views/HoSoView.vue'),
      meta: { requiresAuth: true }
    },
    // F-UI-02 — lịch sử SOS cá nhân, chỉ victim (người gửi SOS).
    {
      path: '/lich-su',
      name: 'lich-su',
      component: () => import('@/views/LichSuSosView.vue'),
      meta: { requiresAuth: true, roles: ['victim'] as UserRole[] }
    },
    {
      path: '/rescuer',
      name: 'rescuer',
      component: () => import('@/views/RescuerView.vue'),
      meta: { requiresAuth: true, roles: ['rescuer'] as UserRole[] }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
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

export default router
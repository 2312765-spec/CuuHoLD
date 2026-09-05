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
    // Chưa đăng nhập mà vào khu vực cần quyền → đưa về trang chủ (modal đăng nhập ở đó).
    return { name: 'home' }
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
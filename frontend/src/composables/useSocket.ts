// Composable quản lý vòng đời kết nối Socket.IO — tách riêng khỏi component.
// Gắn JWT khi connect (backend verify trong handleConnection, disconnect ngay nếu sai —
// CLAUDE.md Mục 8), lắng nghe đúng các event thật trong shared/socket-events.types.

import { ref, onUnmounted } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket'
import type {
  SosNewPayload,
  SosUpdatedPayload,
  TeamLocationPayload,
  SystemNotificationPayload
} from '@/shared/socket-events.types'
import { useAuthStore } from '@/stores/auth.store'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketHandlers {
  onSosNew?: (data: SosNewPayload) => void
  onSosUpdated?: (data: SosUpdatedPayload) => void
  onTeamLocation?: (data: TeamLocationPayload) => void
  onSystemNotification?: (data: SystemNotificationPayload) => void
}

export function useSocket(handlers: SocketHandlers = {}) {
  const isConnected = ref(false)
  const daThuKetNoi = ref(false)
  let socket: AppSocket | null = null

  function connect(url: string) {
    const authStore = useAuthStore()

    // Ngắt kết nối cũ trước khi mở kết nối mới. connect() giờ được gọi lại mỗi lần đổi
    // phiên đăng nhập (xem MapView.vue), mà trước đây gọi lần 2 chỉ ghi đè biến `socket` —
    // socket cũ vẫn sống, vẫn nghe event và vẫn mang JWT của người dùng CŨ.
    disconnect()

    // sos.gateway.ts verify JWT trong handleConnection() và disconnect() ngay nếu không
    // có/không hợp lệ. Nối khi chưa đăng nhập vì thế luôn thất bại, lại còn khiến
    // socket.io thử lại 5 lần (reconnectionAttempts) hoàn toàn vô ích. Không nối, và để
    // isConnected = false — MapView.vue ẩn hẳn chỉ báo "Thời gian thực" khi chưa đăng nhập
    // vì báo "mất kết nối" cho người vốn không được phép kết nối là báo động giả.
    if (!authStore.accessToken) return

    daThuKetNoi.value = true

    socket = io(url, {
      // Gửi kèm JWT ngay lúc bắt tay — backend verify trong handleConnection().
      auth: { token: authStore.accessToken },
      reconnectionAttempts: 5,
      timeout: 4000
    })

    socket.on('connect', () => {
      isConnected.value = true
    })
    socket.on('disconnect', () => {
      isConnected.value = false
    })
    socket.on('connect_error', () => {
      isConnected.value = false
    })

    socket.on('sos:new', (data) => handlers.onSosNew?.(data))
    socket.on('sos:updated', (data) => handlers.onSosUpdated?.(data))
    socket.on('team:location-updated', (data) => handlers.onTeamLocation?.(data))
    socket.on('notification:system', (data) => handlers.onSystemNotification?.(data))
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    isConnected.value = false
  }

  onUnmounted(() => disconnect())

  return { isConnected, daThuKetNoi, connect, disconnect }
}
// "Hợp đồng" sự kiện Socket.IO — client và backend đều bám theo. Event name + payload
// import từ shared, KHÔNG tự định nghĩa lại (CLAUDE.md Mục 8).

import type {
  SosNewPayload,
  SosUpdatedPayload,
  TeamLocationPayload,
  SystemNotificationPayload
} from '@/shared/socket-events.types'

// Sự kiện SERVER gửi XUỐNG cho client
export interface ServerToClientEvents {
  'sos:new': (data: SosNewPayload) => void
  'sos:updated': (data: SosUpdatedPayload) => void
  'team:location-updated': (data: TeamLocationPayload) => void
  'notification:system': (data: SystemNotificationPayload) => void
}

// Sự kiện CLIENT gửi LÊN cho server
export interface ClientToServerEvents {
  'team:update-location': (data: { teamId: string; lat: number; lng: number }) => void
  'sos:victim-cancel': (data: { sosId: string }) => void
  'commander:assign-team': (data: { sosId: string; teamId: string }) => void
  'rescuer:update-status': (data: { sosId: string; status: string }) => void
}
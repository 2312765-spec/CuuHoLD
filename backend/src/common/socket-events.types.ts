// Mirror của ../../shared/socket-events.types.ts (repo root).
// Backend chưa có workspace tooling (npm workspaces / TS project references)
// để import thẳng file ngoài rootDir mà không phá cấu trúc dist/ (xem
// start:prod = "node dist/main"). Khi thiết lập tooling đó, gộp lại làm một
// và xoá file mirror này.
//
// KHÔNG sửa nội dung ở đây mà không đồng bộ với shared/socket-events.types.ts.

export type SosType =
  | 'flood'
  | 'landslide'
  | 'accident'
  | 'medical'
  | 'fire'
  | 'lost'
  | 'drowning'
  | 'agricultural'
  | 'adventure'
  | 'other';

export type SosStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'arrived'
  | 'resolved'
  | 'cancelled'
  | 'false_alarm';

export type UserRole = 'victim' | 'rescuer' | 'commander';

export type RescueTeamStatus = 'available' | 'busy' | 'offline';

export const SOCKET_EVENTS = {
  SOS_NEW: 'sos:new',
  SOS_UPDATED: 'sos:updated',
  TEAM_LOCATION_UPDATED: 'team:location-updated',
  NOTIFICATION_SYSTEM: 'notification:system',
  TEAM_UPDATE_LOCATION: 'team:update-location',
  SOS_VICTIM_CANCEL: 'sos:victim-cancel',
  COMMANDER_ASSIGN_TEAM: 'commander:assign-team',
  RESCUER_UPDATE_STATUS: 'rescuer:update-status',
} as const;

// ── Server → Client ──────────────────────────────────────────

export interface SosNewPayload {
  sosId: string;
  victimId: string;
  victimName: string;
  victimPhone: string;
  type: SosType;
  status: SosStatus;
  lat: number;
  lng: number;
  // true nếu toạ độ chỉ là ước tính (GPS thất bại/bị từ chối quyền, xem CreateSosDto) —
  // rescuer/commander cần biết để không hoàn toàn tin vào ghim trên bản đồ.
  locationEstimated: boolean;
  wardCode: string;
  createdAt: string;
  cancelDeadline: string;
}

export interface SosUpdatedPayload {
  sosId: string;
  status: SosStatus;
  wardCode: string;
  assignedTeamId?: string;
  penaltyApplied?: boolean;
  updatedAt: string;
}

export interface TeamLocationPayload {
  teamId: string;
  lat: number;
  lng: number;
  wardCode: string;
  updatedAt: string;
}

export interface SystemNotificationPayload {
  message: string;
  level: 'info' | 'warning' | 'critical';
  wardCode?: string;
  createdAt: string;
}

// ── Client → Server ──────────────────────────────────────────

export interface TeamUpdateLocationPayload {
  teamId: string;
  lat: number;
  lng: number;
}

export interface SosVictimCancelPayload {
  sosId: string;
}

export interface CommanderAssignTeamPayload {
  sosId: string;
  teamId: string;
}

export interface RescuerUpdateStatusPayload {
  sosId: string;
  status: SosStatus;
}

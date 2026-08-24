// Types Socket.io dùng chung giữa backend (NestJS) và frontend (Vue 3).
// KHÔNG định nghĩa lại các type này ở nơi khác — import từ file này.
// Xem CLAUDE.md Mục 8 — WebSocket Events.

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
  districtCode: string;
  createdAt: string;
  cancelDeadline: string;
}

export interface SosUpdatedPayload {
  sosId: string;
  status: SosStatus;
  districtCode: string;
  assignedTeamId?: string;
  penaltyApplied?: boolean;
  updatedAt: string;
}

export interface TeamLocationPayload {
  teamId: string;
  lat: number;
  lng: number;
  districtCode: string;
  updatedAt: string;
}

export interface SystemNotificationPayload {
  message: string;
  level: 'info' | 'warning' | 'critical';
  districtCode?: string;
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

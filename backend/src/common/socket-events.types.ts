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

// Cảnh báo/chặn đường và báo cáo cộng đồng về chúng (CLAUDE.md Mục 15.14, 15.16).
export type HazardType =
  'landslide' | 'fallen_tree' | 'flood' | 'danger' | 'other';

export type HazardReportStatus = 'pending' | 'approved' | 'rejected';

export const SOCKET_EVENTS = {
  SOS_NEW: 'sos:new',
  SOS_UPDATED: 'sos:updated',
  TEAM_LOCATION_UPDATED: 'team:location-updated',
  NOTIFICATION_SYSTEM: 'notification:system',
  HAZARD_REPORT_NEW: 'hazard-report:new',
  HAZARD_REPORT_REVIEWED: 'hazard-report:reviewed',
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

// Báo cáo cộng đồng mới chờ duyệt — CHỈ gửi cho commander (phòng province:lamdong), KHÔNG bao giờ
// gửi vào phòng ward:* vì có tên người báo. Khi báo cáo là bản TRÙNG được gộp vào báo cáo chính,
// mergedIntoReportId trỏ tới báo cáo chính (client chỉ cần làm mới hàng đợi, không thêm mục mới).
export interface HazardReportNewPayload {
  reportId: string;
  mergedIntoReportId: string | null;
  type: HazardType;
  reporterName: string;
  wardCode: string | null;
  // Số người (khác nhau) đã báo cáo điểm này, tính cả báo cáo vừa gửi.
  reporterCount: number;
  createdAt: string;
}

// Một commander vừa duyệt/từ chối báo cáo — để commander khác làm mới hàng đợi/lịch sử. Cũng chỉ
// gửi cho commander.
export interface HazardReportReviewedPayload {
  reportId: string;
  status: 'approved' | 'rejected';
  hazardId: string | null;
  reviewerName: string;
  // Số báo cáo trùng được xử lý theo cùng (không tính báo cáo chính).
  mergedCount: number;
  updatedAt: string;
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

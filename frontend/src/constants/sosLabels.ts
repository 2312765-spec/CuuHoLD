// Nhãn hiển thị cho SosType/SosStatus — TRƯỚC ĐÂY mỗi view (MapView, RescuerView,
// DashboardView) tự định nghĩa lại cùng 2 bảng này, dễ lệch nhau khi thêm loại SOS mới
// (sửa 1 nơi quên 2 nơi còn lại). MapView.vue và SosTrackerPanel.vue dùng chung file này;
// RescuerView/DashboardView có thể chuyển sang dùng sau, chưa đổi trong lần sửa này.

import type { SosType, SosStatus, RescueTeamStatus } from '@/types'

export const SOS_TYPE_LABEL: Record<SosType, string> = {
  flood: 'Lũ lụt',
  landslide: 'Sạt lở',
  accident: 'Tai nạn',
  medical: 'Y tế khẩn cấp',
  fire: 'Cháy',
  lost: 'Mất tích / lạc',
  drowning: 'Đuối nước',
  agricultural: 'Nông nghiệp',
  adventure: 'Tai nạn dã ngoại',
  other: 'Khác'
}

export const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  pending: 'Chờ xử lý',
  assigned: 'Đã phân công',
  in_progress: 'Đang thực hiện',
  arrived: 'Đã đến nơi',
  resolved: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  false_alarm: 'Báo giả'
}

// Trạng thái đội cứu hộ — RescueMap.vue (marker tooltip, cả DashboardView lẫn RescuerView).
export const RESCUE_TEAM_STATUS_LABEL: Record<RescueTeamStatus, string> = {
  available: 'Sẵn sàng',
  busy: 'Đang bận',
  offline: 'Ngoại tuyến'
}

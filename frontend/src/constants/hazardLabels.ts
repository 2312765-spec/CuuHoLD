// Nhãn hiển thị cho cảnh báo/chặn đường và báo cáo cộng đồng — dùng chung cho form báo cáo,
// bảng kiểm duyệt và Dashboard (trước đây mỗi nơi tự định nghĩa lại cùng một bảng).

import type { HazardType, HazardSeverity, ReportStatus } from '@/types'

export const HAZARD_TYPES: HazardType[] = ['landslide', 'fallen_tree', 'flood', 'danger', 'other']

export const HAZARD_TYPE_LABEL: Record<HazardType, string> = {
  landslide: 'Sạt lở',
  fallen_tree: 'Cây đổ',
  flood: 'Ngập lụt',
  danger: 'Nguy hiểm',
  other: 'Cảnh báo khác'
}

// 'blocked' = ĐỎ (chặn đường, tuyến đi né), 'caution' = VÀNG (cẩn trọng, chỉ hiển thị).
export const HAZARD_SEVERITY_LABEL: Record<HazardSeverity, string> = {
  blocked: 'Đỏ',
  caution: 'Vàng'
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Không được duyệt'
}

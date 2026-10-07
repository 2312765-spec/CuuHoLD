import type { HazardType } from '../common/socket-events.types';

// Nguồn định nghĩa duy nhất của HazardType nằm ở socket-events.types (payload socket dùng chung).
export type { HazardType };

export const HAZARD_TYPES: readonly HazardType[] = [
  'landslide',
  'fallen_tree',
  'flood',
  'danger',
  'other',
] as const;

// 'blocked' = ĐỎ: chặn đường, thuật toán tìm đường né vùng này (avoid_polygons).
// 'caution' = VÀNG: cẩn trọng, chỉ hiển thị trên bản đồ, KHÔNG làm tuyến đi vòng.
export type HazardSeverity = 'blocked' | 'caution';

export const HAZARD_SEVERITIES: readonly HazardSeverity[] = [
  'blocked',
  'caution',
] as const;

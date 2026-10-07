// Service GIS. Backend trả { success, data, message } — unwrap .data.data.
// Role commander (api-contract Mục 3).

import { http } from './http'
import { CONFIG } from '@/config'
import type { NearestTeam, SosHeatmapPoint, StatsResult } from '@/types'

// GET /api/gis/nearest-teams — đội `available` gần toạ độ, sắp xếp theo khoảng cách.
export async function timDoiGanNhat(
  lat: number,
  lng: number,
  radiusMeters = 10000,
  limit = 5
): Promise<NearestTeam[]> {
  const { data } = await http.get(CONFIG.endpoints.gisNearestTeams, {
    params: { lat, lng, radiusMeters, limit }
  })
  return data.data as NearestTeam[]
}

// GET /api/gis/sos-heatmap — số vụ SOS theo xã/phường trong khoảng thời gian, sắp xếp giảm dần.
export async function layThongKeSosTheoXa(from: Date, to: Date): Promise<SosHeatmapPoint[]> {
  const { data } = await http.get(CONFIG.endpoints.gisSosHeatmap, {
    params: { from: from.toISOString(), to: to.toISOString() }
  })
  return data.data as SosHeatmapPoint[]
}

// GET /api/gis/stats — thống kê tổng quan (SOS theo trạng thái/loại, thời gian phản hồi
// trung bình, đội theo trạng thái, số tài khoản bị flag) trong khoảng thời gian.
export async function layThongKeTongQuan(from: Date, to: Date): Promise<StatsResult> {
  const { data } = await http.get(CONFIG.endpoints.gisStats, {
    params: { from: from.toISOString(), to: to.toISOString() }
  })
  return data.data as StatsResult
}

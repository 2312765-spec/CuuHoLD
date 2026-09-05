// Service GIS. Backend trả { success, data, message } — unwrap .data.data.
// Role commander (api-contract Mục 3).

import { http } from './http'
import { CONFIG } from '@/config'
import type { NearestTeam } from '@/types'

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

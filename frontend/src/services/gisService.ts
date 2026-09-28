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

// GET /api/gis/sos-heatmap — SOS trong khoảng [from, to], mỗi dòng 1 toạ độ + số lần báo.
// Trả về dạng [lat, lng, trọng số] để đưa thẳng vào leaflet.heat (F-MAP-03).
interface DongHeatmap {
  lat: number
  lng: number
  ward_code: string | null
  incident_count: number
}
export async function layHeatmapSos(from: Date, to: Date): Promise<[number, number, number][]> {
  const { data } = await http.get(CONFIG.endpoints.gisSosHeatmap, {
    params: { from: from.toISOString(), to: to.toISOString() }
  })
  return (data.data as DongHeatmap[]).map((d) => [Number(d.lat), Number(d.lng), d.incident_count])
}

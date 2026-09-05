// Service gọi API đội cứu hộ. Backend trả { success, data, message } — unwrap .data.data.

import { http } from './http'
import { CONFIG } from '@/config'
import type { RescueTeam, UpdateTeamLocationResult } from '@/types'

export async function fetchRescueTeams(): Promise<RescueTeam[]> {
  const { data } = await http.get(CONFIG.endpoints.rescueTeams)
  return data.data as RescueTeam[]
}

// PATCH /api/rescue-teams/:id/location (role rescuer, leader đội đó). Gọi định kỳ khi có SOS active.
export async function capNhatViTriDoi(
  teamId: string,
  lat: number,
  lng: number
): Promise<UpdateTeamLocationResult> {
  const { data } = await http.patch(`${CONFIG.endpoints.rescueTeams}/${teamId}/location`, { lat, lng })
  return data.data as UpdateTeamLocationResult
}
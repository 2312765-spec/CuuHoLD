// Service routing (OpenRouteService qua backend, CLAUDE.md Mục 15.13).
// GET /api/routing/route — role rescuer.
//
// Nuốt lỗi, trả null thay vì throw: đường chim bay (utils/geo.ts) đã vẽ sẵn làm fallback ở
// RescuerView.vue ngay khi chưa/không có route thật (thiếu ORS_API_KEY, ORS lỗi, mất mạng...)
// — đây là tính năng NÂNG CAO, không nên hiện toast lỗi mỗi lần gọi thất bại.

import { http } from './http'
import { CONFIG } from '@/config'
import type { RouteResult } from '@/types'
import type { ToaDo } from '@/utils/geo'

export async function layTuyenDuongThat(from: ToaDo, to: ToaDo): Promise<RouteResult | null> {
  try {
    const { data } = await http.get(CONFIG.endpoints.routing, {
      params: { fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng },
      khongHienToastLoi: true
    })
    return data.data as RouteResult
  } catch {
    return null
  }
}

// Service báo cáo cộng đồng về sạt lở/chặn đường. Gửi báo cáo + xem "của tôi": mọi vai trò đã đăng
// nhập; hàng đợi/lịch sử kiểm duyệt / duyệt / từ chối / ảnh của người khác: chỉ commander (backend
// chặn sẵn). Backend trả { success, data, message } — unwrap .data.data. Response snake_case (wrap
// raw SQL).

import { http } from './http'
import { CONFIG } from '@/config'
import type {
  CreateReportResult,
  Hazard,
  HazardReport,
  HazardReportAdmin,
  HazardSeverity,
  HazardType,
  ReportStatus,
  ReviewOutcome
} from '@/types'

export interface SubmitReportInput {
  type: HazardType
  description?: string
  lat: number
  lng: number
  accuracyMeters?: number | null
  locationEstimated: boolean
  // BẮT BUỘC: ảnh hiện trường chụp trực tiếp bằng camera (server cũng từ chối nếu thiếu).
  image: Blob
}

// POST multipart/form-data — phải ghi đè Content-Type mặc định 'application/json' của instance http
// (services/http.ts): giữ nguyên thì axios tự chuyển FormData thành JSON (file ảnh mất, server báo
// "property image should not exist"). Với 'multipart/form-data' trình duyệt tự thêm boundary đúng.
export async function guiBaoCaoCongDong(input: SubmitReportInput): Promise<CreateReportResult> {
  const form = new FormData()
  form.append('type', input.type)
  if (input.description) form.append('description', input.description)
  form.append('lat', String(input.lat))
  form.append('lng', String(input.lng))
  if (input.accuracyMeters != null) form.append('accuracyMeters', String(input.accuracyMeters))
  form.append('locationEstimated', String(input.locationEstimated))
  form.append('image', input.image, 'hien-truong.jpg')
  const { data } = await http.post(CONFIG.endpoints.hazardReports, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000 // ảnh tải lên qua 4G yếu cần lâu hơn 8s mặc định
  })
  return data.data as CreateReportResult
}

export async function layBaoCaoCuaToi(): Promise<HazardReport[]> {
  const { data } = await http.get(`${CONFIG.endpoints.hazardReports}/mine`)
  return data.data as HazardReport[]
}

// Commander: hàng đợi kiểm duyệt (pending) hoặc lịch sử đã duyệt/từ chối, có phân trang. Mỗi mục là
// 1 báo cáo chính; các báo cáo trùng đã gộp nằm trong `duplicates`.
export async function layBaoCaoDeKiemDuyet(
  status: ReportStatus = 'pending',
  phanTrang: { limit?: number; offset?: number } = {}
): Promise<HazardReportAdmin[]> {
  const { data } = await http.get(CONFIG.endpoints.hazardReports, {
    params: { status, ...phanTrang }
  })
  return data.data as HazardReportAdmin[]
}

// Ảnh cần JWT nên không dùng được thẻ <img src> trực tiếp (không gửi được header Authorization) —
// tải về dạng blob rồi tạo object URL. Người gọi chịu trách nhiệm URL.revokeObjectURL khi xong.
export async function taiAnhBaoCao(id: string): Promise<string> {
  const res = await http.get(`${CONFIG.endpoints.hazardReports}/${id}/image`, {
    responseType: 'blob'
  })
  return URL.createObjectURL(res.data as Blob)
}

export async function duyetBaoCao(
  id: string,
  opts: { severity: HazardSeverity; radiusMeters?: number; note?: string }
): Promise<ReviewOutcome & { hazard: Hazard }> {
  const { data } = await http.patch(`${CONFIG.endpoints.hazardReports}/${id}/approve`, opts)
  return data.data as ReviewOutcome & { hazard: Hazard }
}

export async function tuChoiBaoCao(id: string, note?: string): Promise<ReviewOutcome> {
  const { data } = await http.patch(`${CONFIG.endpoints.hazardReports}/${id}/reject`, { note })
  return data.data as ReviewOutcome
}

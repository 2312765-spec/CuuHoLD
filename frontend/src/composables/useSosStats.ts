// Thống kê nhanh danh sách SOS cho Bảng điều phối (F-DASH-01). Thuần client: nhận ref danh
// sách SOS + 2 bảng nhãn, trả về các số liệu computed (tự cập nhật khi socket đẩy SOS mới).
// Không gọi API, không cần thư viện biểu đồ — phần "biểu đồ" vẽ bằng thanh CSS ở view.

import { computed, type Ref } from 'vue'
import type { SosListItem, SosType, SosStatus } from '@/types'

// Các trạng thái muốn nhấn thành thẻ số liệu (theo thứ tự vòng đời xử lý).
const TRANG_THAI_NHAN: SosStatus[] = ['pending', 'assigned', 'in_progress', 'resolved']

export function useSosStats(
  sosList: Ref<SosListItem[]>,
  nhanLoai: Record<SosType, string>,
  nhanTrangThai: Record<SosStatus, string>
) {
  const tong = computed(() => sosList.value.length)

  const theoTrangThai = computed(() =>
    TRANG_THAI_NHAN.map((key) => ({
      key,
      label: nhanTrangThai[key],
      count: sosList.value.filter((s) => s.status === key).length
    }))
  )

  // Đếm theo loại, chỉ giữ loại có ít nhất 1 SOS, sắp giảm dần; percent theo loại cao nhất
  // để vẽ độ dài thanh.
  const theoLoai = computed(() => {
    const dem = new Map<SosType, number>()
    for (const s of sosList.value) dem.set(s.type, (dem.get(s.type) ?? 0) + 1)
    const arr = [...dem.entries()]
      .map(([key, count]) => ({ key, label: nhanLoai[key] ?? key, count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
    const max = arr.reduce((m, x) => Math.max(m, x.count), 0) || 1
    return arr.map((x) => ({ ...x, percent: Math.round((x.count / max) * 100) }))
  })

  return { tong, theoTrangThai, theoLoai }
}
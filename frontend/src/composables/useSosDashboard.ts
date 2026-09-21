// Lọc / tìm kiếm danh sách SOS (F-MAP-02) và xuất CSV (F-DASH-02) cho Bảng điều phối.
// Thuần client: nhận ref danh sách SOS đang có + 2 bảng nhãn, trả về state bộ lọc, danh
// sách đã lọc và hàm xuất CSV. Không gọi thêm API, không đụng backend.

import { ref, computed, type Ref } from 'vue'
import type { SosListItem, SosType, SosStatus } from '@/types'

export function useSosDashboard(
  sosList: Ref<SosListItem[]>,
  nhanLoai: Record<SosType, string>,
  nhanTrangThai: Record<SosStatus, string>
) {
  const locLoai = ref<SosType | 'all'>('all')
  const locTrangThai = ref<SosStatus | 'all'>('all')
  const tuKhoa = ref('')

  const danhSachLoc = computed(() => {
    const kw = tuKhoa.value.trim().toLowerCase()
    return sosList.value.filter((s) => {
      if (locLoai.value !== 'all' && s.type !== locLoai.value) return false
      if (locTrangThai.value !== 'all' && s.status !== locTrangThai.value) return false
      if (kw) {
        const ten = (s.victim_name ?? '').toLowerCase()
        const sdt = (s.victim_phone ?? '').toLowerCase()
        if (!ten.includes(kw) && !sdt.includes(kw)) return false
      }
      return true
    })
  })

  const dangLoc = computed(
    () => locLoai.value !== 'all' || locTrangThai.value !== 'all' || tuKhoa.value.trim() !== ''
  )

  function xoaLoc(): void {
    locLoai.value = 'all'
    locTrangThai.value = 'all'
    tuKhoa.value = ''
  }

  // Xuất danh sách ĐANG hiển thị (sau lọc) ra CSV. Thêm BOM \uFEFF để Excel đọc đúng
  // tiếng Việt UTF-8; bọc mọi ô trong dấu "" và nhân đôi " bên trong cho an toàn.
  function xuatCsv(): void {
    const cols = [
      'Mã', 'Loại', 'Trạng thái', 'Nạn nhân', 'SĐT',
      'Xã/phường', 'Vĩ độ', 'Kinh độ', 'Vị trí ước tính', 'Thời gian'
    ]
    const rows = danhSachLoc.value.map((s) => [
      s.id,
      nhanLoai[s.type] ?? s.type,
      nhanTrangThai[s.status] ?? s.status,
      s.victim_name ?? '',
      s.victim_phone ?? '',
      s.ward_code ?? '',
      String(s.lat ?? ''),
      String(s.lng ?? ''),
      s.location_estimated ? 'Có' : 'Không',
      new Date(s.created_at).toLocaleString('vi-VN')
    ])
    const boc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map((r) => r.map(boc).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { locLoai, locTrangThai, tuKhoa, danhSachLoc, dangLoc, xoaLoc, xuatCsv }
}
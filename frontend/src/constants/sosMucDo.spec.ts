// Sắp xếp SOS cho Bảng điều phối: ca nguy kịch chưa ai nhận lên đầu, ca đã kết thúc luôn ở cuối.
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { sapXepSos, mucDoSos } from './sosMucDo'
import { useSosDashboard } from '@/composables/useSosDashboard'
import { SOS_TYPE_LABEL, SOS_STATUS_LABEL } from './sosLabels'
import type { SosListItem } from '@/types'

function sos(id: string, type: SosListItem['type'], status: SosListItem['status'], phut: number, xa = '24778'): SosListItem {
  return {
    id, type, status, ward_code: xa,
    created_at: new Date(Date.UTC(2026, 10, 8, 14, phut)).toISOString(),
    lat: 11.9, lng: 108.4, location_estimated: false, victim_name: id, victim_phone: '0900000001'
  }
}

const DS = [
  sos('tai-nan-moi', 'accident', 'pending', 30),
  sos('duoi-nuoc-da-xong', 'drowning', 'resolved', 50),
  sos('lac-cu', 'lost', 'pending', 5),
  sos('chay-da-giao', 'fire', 'assigned', 20),
  sos('chay-cho', 'fire', 'pending', 10),
  sos('khac', 'other', 'pending', 40)
]

describe('sapXepSos', () => {
  it('khẩn cấp: theo mức độ, cùng mức thì ca chờ xử lý trước, đã kết thúc xuống cuối', () => {
    expect(sapXepSos(DS, 'khan-cap').map((s) => s.id)).toEqual([
      'chay-cho', 'chay-da-giao', 'tai-nan-moi', 'lac-cu', 'khac', 'duoi-nuoc-da-xong'
    ])
  })

  it('mới nhất / chờ lâu nhất — vẫn đẩy ca đã kết thúc xuống cuối', () => {
    expect(sapXepSos(DS, 'moi-nhat').map((s) => s.id)[0]).toBe('khac')
    expect(sapXepSos(DS, 'cho-lau-nhat').map((s) => s.id)[0]).toBe('lac-cu')
    expect(sapXepSos(DS, 'moi-nhat').at(-1)?.id).toBe('duoi-nuoc-da-xong')
  })

  it('không sắp xếp tại chỗ mảng gốc (socket còn sửa mảng đó)', () => {
    const goc = [...DS]
    sapXepSos(DS, 'khan-cap')
    expect(DS).toEqual(goc)
  })

  it('mọi loại SOS đều có mức độ', () => {
    for (const loai of Object.keys(SOS_TYPE_LABEL) as SosListItem['type'][]) {
      expect(['nguy-kich', 'nang', 'vua', 'nhe']).toContain(mucDoSos(loai))
    }
  })
})

describe('useSosDashboard — lọc theo xã', () => {
  it('chỉ giữ SOS của xã đã chọn, "Xoá lọc" bỏ cả lọc xã', () => {
    const list = ref([sos('a', 'flood', 'pending', 1, '24778'), sos('b', 'flood', 'pending', 2, '24781')])
    const d = useSosDashboard(list, SOS_TYPE_LABEL, SOS_STATUS_LABEL)
    d.locXa.value = '24781'
    expect(d.danhSachLoc.value.map((s) => s.id)).toEqual(['b'])
    expect(d.dangLoc.value).toBe(true)
    d.xoaLoc()
    expect(d.locXa.value).toBe('')
    expect(d.danhSachLoc.value).toHaveLength(2)
  })
})

// Pinia store — nguồn dữ liệu cho bản đồ. Phase 5.3: nguồn dữ liệu điểm cứu hộ giờ lấy từ
// API rescue-teams thật (RescueTeam), nhưng vẫn ÁNH XẠ về dạng UI cũ (DiemCuuTro) để lớp
// vẽ marker (useLeafletMap) chưa phải viết lại — sẽ refactor triệt để ở Phase 5.4.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DiemCuuTro, BaoCaoSuCo, MapLayerKey, RescueTeam } from '@/types'
import { fetchRescueTeams } from '@/services/rescueTeamsService'

// Chuyển RescueTeam (shape backend) → DiemCuuTro (shape UI marker hiện tại).
// Bỏ qua đội chưa có toạ độ (lat/lng null — api-contract cho phép null).
function rescueTeamToDiem(t: RescueTeam): DiemCuuTro | null {
  if (t.lat == null || t.lng == null) return null
  const mau = t.status === 'available' ? '#1f3d2e' : t.status === 'busy' ? '#d99a35' : '#8a8780'
  return { ten: t.name, lat: t.lat, lng: t.lng, loai: `Đội cứu hộ · ${t.status}`, mau }
}

export const useMapDataStore = defineStore('mapData', () => {
  // Dữ liệu minh hoạ ban đầu (fallback khi chưa gọi API hoặc API lỗi).
  const diemCuuTro = ref<DiemCuuTro[]>([
    { ten: 'Nhà văn hoá Đà Lạt', lat: 11.9404, lng: 108.4383, loai: 'Điểm tiếp nhận', mau: '#1f3d2e' },
    { ten: 'Trung tâm y tế Bảo Lộc', lat: 11.5459, lng: 107.8091, loai: 'Điểm tiếp nhận', mau: '#1f3d2e' },
    { ten: 'Kho vật tư Phan Thiết', lat: 10.9333, lng: 108.1, loai: 'Điểm tiếp nhận', mau: '#1f3d2e' },
    { ten: 'Trạm y tế Gia Nghĩa', lat: 12.0044, lng: 107.6877, loai: 'Điểm tiếp nhận', mau: '#1f3d2e' },
    { ten: 'Nhà văn hoá Đức Trọng', lat: 11.7583, lng: 108.4267, loai: 'Điểm tiếp nhận', mau: '#1f3d2e' }
  ])
  const dangTaiDiemCuuTro = ref(false)

  async function taiDiemCuuTroTuServer() {
    dangTaiDiemCuuTro.value = true
    try {
      const teams = await fetchRescueTeams()
      const mapped = teams.map(rescueTeamToDiem).filter((d): d is DiemCuuTro => d !== null)
      // Chỉ thay khi có dữ liệu thật; API rỗng/lỗi thì giữ mock để bản đồ không trống.
      if (mapped.length > 0) diemCuuTro.value = mapped
    } catch {
      // Interceptor http.ts đã hiện toast — giữ nguyên dữ liệu cũ làm fallback.
    } finally {
      dangTaiDiemCuuTro.value = false
    }
  }

  const baoCaoSuCo = ref<BaoCaoSuCo[]>([
    { ten: 'Sạt lở đèo Bảo Lộc', lat: 11.4767, lng: 107.7967, mucDo: 'Khẩn cấp', mau: '#a8462b' },
    { ten: 'Ngập cục bộ khu vực Di Linh', lat: 11.5764, lng: 108.0742, mucDo: 'Cảnh báo', mau: '#d99a35' },
    { ten: 'Cây đổ quốc lộ 28, Đắk Glong cũ', lat: 12.08, lng: 107.79, mucDo: 'Cảnh báo', mau: '#d99a35' }
  ])

  const soDiemTheoLop = computed(() => {
    return (layer: MapLayerKey): number => {
      if (layer === 'diem-cuutro') return diemCuuTro.value.length
      if (layer === 'bao-cao') return baoCaoSuCo.value.length
      return diemCuuTro.value.length + baoCaoSuCo.value.length
    }
  })

  function themBaoCao(baoCao: BaoCaoSuCo) {
    baoCaoSuCo.value.push(baoCao)
  }

  function xacNhanDaXuLy(baoCao: BaoCaoSuCo) {
    baoCaoSuCo.value = baoCaoSuCo.value.filter((b) => b !== baoCao)
  }

  return {
    diemCuuTro, baoCaoSuCo, soDiemTheoLop,
    themBaoCao, xacNhanDaXuLy,
    dangTaiDiemCuuTro, taiDiemCuuTroTuServer
  }
})
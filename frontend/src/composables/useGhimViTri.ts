// F-SOS-07 — Ghim vị trí bằng tay trên bản đồ để báo SOS HỘ người khác (người báo không đứng
// tại chỗ người gặp nạn, nên GPS của máy người báo là vô nghĩa cho SOS này).
//
// Bật chế độ ghim: chạm bản đồ đặt ghim, kéo ghim để chỉnh. Tắt chế độ: gỡ ghim, trả lại con
// trỏ bình thường. Chỉ nhận vị trí nằm trong khung ranh giới tỉnh (nếu có) — ghim nhầm ra
// ngoài tỉnh thì không đội nào trong hệ thống tới được.
import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import L from 'leaflet'
import type { ToaDo } from '@/utils/geo'

// Zoom tối thiểu khi đặt ghim: ghim ở mức nhìn cả tỉnh thì 1 lần chạm lệch hàng km.
const ZOOM_TOI_THIEU_KHI_GHIM = 15

const ICON_GHIM = L.divIcon({
  className: 'ghim-bao-ho',
  html: '<span class="ghim-bao-ho__dau"></span>',
  iconSize: [30, 40],
  iconAnchor: [15, 40]
})

export function useGhimViTri(
  // Readonly<Ref> thay vì ShallowRef: Bảng điều phối truyền computed lấy từ ref của RescueMap.
  mapInstance: Readonly<Ref<L.Map | null>>,
  dangGhim: Ref<boolean>,
  khungHopLe?: () => L.LatLngBounds | null,
  // Chữ hiện khi rê chuột lên ghim — báo hộ SOS và đặt cảnh báo dùng chung ghim này.
  tieuDeGhim = 'Vị trí người cần cứu (kéo để chỉnh)'
) {
  const viTriGhim = ref<ToaDo | null>(null)
  const loiGhim = ref<string | null>(null)
  let marker: L.Marker | null = null

  function datGhim(lat: number, lng: number): void {
    const map = mapInstance.value
    if (!map) return
    const khung = khungHopLe?.()
    if (khung && !khung.contains([lat, lng])) {
      loiGhim.value = 'Vị trí này nằm ngoài tỉnh Lâm Đồng. Hãy ghim lại trong khu vực tỉnh.'
      if (marker && viTriGhim.value) marker.setLatLng([viTriGhim.value.lat, viTriGhim.value.lng])
      return
    }
    loiGhim.value = null
    viTriGhim.value = { lat, lng }
    if (!marker) {
      marker = L.marker([lat, lng], {
        icon: ICON_GHIM,
        draggable: true,
        keyboard: true,
        title: tieuDeGhim,
        zIndexOffset: 1000
      }).addTo(map)
      marker.on('dragend', () => {
        const ll = marker?.getLatLng()
        if (ll) datGhim(ll.lat, ll.lng)
      })
    } else {
      marker.setLatLng([lat, lng])
    }
    if (map.getZoom() < ZOOM_TOI_THIEU_KHI_GHIM) map.setView([lat, lng], ZOOM_TOI_THIEU_KHI_GHIM)
  }

  // Cho người dùng bàn phím / khó chạm chính xác: kéo bản đồ tới đúng chỗ rồi ghim ở tâm.
  function ghimTaiTamBanDo(): void {
    const tam = mapInstance.value?.getCenter()
    if (tam) datGhim(tam.lat, tam.lng)
  }

  function onClickBanDo(e: L.LeafletMouseEvent): void {
    datGhim(e.latlng.lat, e.latlng.lng)
  }

  function xoaGhim(): void {
    marker?.remove()
    marker = null
    viTriGhim.value = null
    loiGhim.value = null
  }

  watch(
    [mapInstance, dangGhim],
    ([map, bat]) => {
      if (!map) return
      if (bat) {
        map.on('click', onClickBanDo)
        map.getContainer().classList.add('dang-ghim')
      } else {
        map.off('click', onClickBanDo)
        map.getContainer().classList.remove('dang-ghim')
        xoaGhim()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    mapInstance.value?.off('click', onClickBanDo)
    xoaGhim()
  })

  return { viTriGhim, loiGhim, ghimTaiTamBanDo, xoaGhim }
}

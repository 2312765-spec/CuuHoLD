// Composable chứa toàn bộ logic Leaflet.
// Điểm mới so với bản trước: marker giờ dùng L.marker + icon tuỳ biến (thay L.circleMarker
// chấm tròn), và nội dung popup được RENDER BẰNG COMPONENT VUE THẬT (MarkerPopupCard.vue)
// thay vì chuỗi HTML tĩnh — có thể bấm nút, gọi thẳng action của Pinia store.

import { h, render, ref, shallowRef } from 'vue'
import L from 'leaflet'
import type { DiemCuuTro, BaoCaoSuCo, MapLayerKey, SosStatus } from '@/types'
import { useMapDataStore } from '@/stores/mapData'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth.store'
import { taoIconMarker, type MarkerKind } from '@/utils/markerIcon'
import MarkerPopupCard from '@/components/map/MarkerPopupCard.vue'
import { taoLopTileNen } from '@/utils/tileLayer'

interface GeoJsonProps {
  TinhThanh: string
  SoXa: number
  Dtich_km2: number
  SapNhap: string
}

export function useLeafletMap() {
  const store = useMapDataStore()
  const toastStore = useToastStore()
  const authStore = useAuthStore()

  const soDiemHienThi = ref(0)
  const boundaryError = ref<string | null>(null)
  // true khi tile nền OSM đang lỗi (mất mạng, OSM chặn...) — KHÔNG dùng chung với
  // boundaryError vì đây là 2 lỗi khác nhau (nền bản đồ vs lớp ranh giới xã/phường).
  // MapView.vue watch ref này để hiện toast, đúng pattern boundaryError đã có sẵn.
  const tileError = ref(false)
  const mapInstance = shallowRef<L.Map | null>(null)

  let diemCuuTroLayer: L.LayerGroup | null = null
  let baoCaoLayer: L.LayerGroup | null = null
  let sosOwnMarker: L.Marker | null = null
  let teamMarker: L.CircleMarker | null = null
  let boundaryLayer: L.GeoJSON | null = null

  // Từ mức zoom này trở lên thì ẩn hẳn lớp ranh giới hành chính. Hai lý do, theo thứ tự
  // quan trọng:
  //
  // 1. NỘI DUNG: zoom ≥ 14 là mức nhìn từng con phố. Lúc đó người dùng đang tìm vị trí SOS
  //    hoặc đội cứu hộ cụ thể, không phải tra xem đang ở xã nào — đường ranh giới hành chính
  //    chạy ngang màn hình lúc này chỉ thêm nhiễu.
  // 2. HIỆU NĂNG + ĐỘ CHÍNH XÁC: lớp ranh giới vẽ bằng canvas (preferCanvas) nên mỗi lần
  //    zoom nó phải chiếu lại toàn bộ toạ độ; ẩn ở zoom sâu là bỏ hẳn phần việc đó đúng lúc
  //    người dùng zoom liên tục nhất. Đồng thời dữ liệu đã simplify với sai số ~25m
  //    (scripts/build-wards-geojson.mjs) — ở vĩ độ Lâm Đồng 1 pixel ≈ 18.7m tại zoom 13,
  //    nên giữ ngưỡng ở 14 đảm bảo sai số luôn dưới 1.3 pixel ở mọi mức còn hiển thị.
  //    ⚠️ Đổi ngưỡng này thì phải xem lại SAI_SO_MET trong build-wards-geojson.mjs cho khớp.
  const ZOOM_AN_RANH_GIOI = 14

  const SOS_STATUS_COLOR: Record<SosStatus, string> = {
    pending: '#dc2626',
    assigned: '#f97316',
    in_progress: '#eab308',
    arrived: '#3b82f6',
    resolved: '#16a34a',
    cancelled: '#9ca3af',
    false_alarm: '#9ca3af'
  }

  // Marker cho ĐÚNG SOS mà victim đang xem đang theo dõi (useSos.ts) — luôn hiện trên mọi
  // lớp, không phụ thuộc tab layer nào, vì đây là thông tin quan trọng nhất với victim lúc này.
  function capNhatMarkerSosCuaMinh(
    sos: { lat: number; lng: number; status: SosStatus; label: string } | null
  ) {
    if (sosOwnMarker) {
      sosOwnMarker.remove()
      sosOwnMarker = null
    }
    if (!sos || !mapInstance.value) return
    sosOwnMarker = L.marker([sos.lat, sos.lng], {
      icon: taoIconMarker(SOS_STATUS_COLOR[sos.status], 'khan-cap'),
      zIndexOffset: 1000
    })
      .bindPopup(`<div class="pin-popup"><b>SOS của bạn</b><span>${sos.label}</span></div>`)
      .addTo(mapInstance.value)
  }

  // Marker đội cứu hộ được giao cho SOS của victim (Fix #2, CLAUDE.md Mục 15.11) — chấm xanh
  // dương, cùng quy ước màu "đội cứu hộ" với RescueMap.vue. Vị trí có thể trễ tới ~50s (poll
  // 20s + GPS đội gửi mỗi 30s): đủ để thấy "đội đang tới", không phải để dẫn đường.
  function capNhatMarkerDoiCuuHo(viTri: { lat: number; lng: number } | null) {
    if (teamMarker) {
      teamMarker.remove()
      teamMarker = null
    }
    if (!viTri || !mapInstance.value) return
    teamMarker = L.circleMarker([viTri.lat, viTri.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1
    })
      .bindTooltip('Đội cứu hộ được phân công', { direction: 'top' })
      .addTo(mapInstance.value)
  }

  function markerTuDuLieu(p: DiemCuuTro | BaoCaoSuCo): L.Marker {
    const isDiem = 'loai' in p
    const kind: MarkerKind = isDiem ? 'tiep-nhan' : p.mucDo === 'Khẩn cấp' ? 'khan-cap' : 'canh-bao'

    const marker = L.marker([p.lat, p.lng], { icon: taoIconMarker(p.mau, kind) })

    // Container rỗng đưa cho Leaflet — Vue sẽ "bơm" nội dung thật vào đây lúc popup mở.
    const popupContainer = document.createElement('div')
    marker.bindPopup(popupContainer, { minWidth: 170 })

    marker.on('popupopen', () => {
      // Chỉ rescuer/commander được đánh dấu báo cáo đã xử lý — victim chỉ được GỬI SOS,
      // không được tự đóng sự cố của mình hay của người khác (xem CLAUDE.md Mục 2 — phân vai).
      const coQuyenXuLy = authStore.role === 'rescuer' || authStore.role === 'commander'
      const vnode = h(MarkerPopupCard, {
        title: p.ten,
        // Điểm cứu trợ: subtitle là loại điểm. Báo cáo sự cố: không có mô tả riêng ngoài tên,
        // nên bỏ subtitle (tránh lặp), chỉ dùng badge cho mức độ (Khẩn cấp/Cảnh báo).
        subtitle: isDiem ? p.loai : undefined,
        badge: isDiem ? undefined : p.mucDo,
        showAction: !isDiem && coQuyenXuLy,
        onAction: () => {
          if (!isDiem && coQuyenXuLy) {
            store.xacNhanDaXuLy(p)
            baoCaoLayer?.removeLayer(marker)
            toastStore.showToast('Đã đánh dấu báo cáo là hoàn tất xử lý.')
          }
        }
      })
      render(vnode, popupContainer)
      // Leaflet đo kích thước popup NGAY lúc mở — nhưng lúc đó Vue chưa kịp bơm nội dung
      // vào (dòng render() ở trên chạy SAU khi Leaflet đã đo xong div rỗng). Nếu không gọi
      // update() ở đây, Leaflet giữ nguyên kích thước cũ (quá nhỏ), khiến chữ tràn ra ngoài
      // khung trắng. update() bảo Leaflet đo lại đúng kích thước sau khi có nội dung thật.
      marker.getPopup()?.update()
    })

    // BẮT BUỘC gỡ component khi popup đóng — không gỡ sẽ rò rỉ bộ nhớ vì Vue vẫn giữ
    // instance component cũ dù người dùng không còn thấy nó trên màn hình nữa.
    marker.on('popupclose', () => {
      render(null, popupContainer)
    })

    return marker
  }

  function buildMarkerLayers() {
    diemCuuTroLayer = L.layerGroup(store.diemCuuTro.map(markerTuDuLieu))
    baoCaoLayer = L.layerGroup(store.baoCaoSuCo.map(markerTuDuLieu))
  }

  function applyLayerVisibility(map: L.Map, activeLayer: MapLayerKey) {
    if (!diemCuuTroLayer || !baoCaoLayer) return
    map.removeLayer(diemCuuTroLayer)
    map.removeLayer(baoCaoLayer)

    if (activeLayer === 'diem-cuutro') {
      diemCuuTroLayer.addTo(map)
    } else if (activeLayer === 'bao-cao') {
      baoCaoLayer.addTo(map)
    } else {
      diemCuuTroLayer.addTo(map)
      baoCaoLayer.addTo(map)
    }
    soDiemHienThi.value = store.soDiemTheoLop(activeLayer)
  }

  function themMarkerBaoCao(baoCao: BaoCaoSuCo, activeLayer: MapLayerKey) {
    if (!baoCaoLayer || !mapInstance.value) return
    markerTuDuLieu(baoCao).addTo(baoCaoLayer)
    applyLayerVisibility(mapInstance.value, activeLayer)
  }

  // Nhận diện phản hồi JSON thật, tránh nuốt nhầm index.html do SPA fallback trả về.
  // GeoJSON có thể được phục vụ dưới 'application/json' hoặc 'application/geo+json'.
  function laJson(res: Response): boolean {
    return (res.headers.get('content-type') ?? '').includes('json')
  }

  // Ẩn/hiện lớp ranh giới theo mức zoom hiện tại. Idempotent — gọi thừa không sao, nên
  // dùng được cho cả lần khởi tạo lẫn mỗi sự kiện zoomend.
  function capNhatHienThiRanhGioi(map: L.Map): void {
    if (!boundaryLayer) return
    const nenHien = map.getZoom() < ZOOM_AN_RANH_GIOI
    const dangHien = map.hasLayer(boundaryLayer)
    if (nenHien && !dangHien) boundaryLayer.addTo(map)
    else if (!nenHien && dangHien) map.removeLayer(boundaryLayer)
  }

  async function initMap(containerId: string, activeLayer: MapLayerKey) {
    // preferCanvas: lớp ranh giới 123 xã/phường có ~510.000 điểm toạ độ. Renderer SVG mặc
    // định tạo mỗi vùng một phần tử DOM và giật rõ khi pan/zoom ở mật độ này; canvas vẽ
    // toàn bộ vào một thẻ <canvas> nên mượt hơn hẳn.
    const map = L.map(containerId, { zoomControl: false, preferCanvas: true }).setView(
      [11.94, 108.44],
      8
    )
    // bottomleft chứ không phải bottomright: góc dưới PHẢI nay dành cho nút SOS (hành động
    // Nút zoom đặt góc phải TRÊN — tránh legend (góc trái dưới) và chỉ báo real-time
    // (góc phải dưới). Đây là góc trống duy nhất không vướng thành phần nào.
    L.control.zoom({ position: 'topright' }).addTo(map)

    // 'load' bắn ĐÚNG MỘT LẦN khi mọi tile trong khung nhìn hiện tại đã xong (thành công
    // hoặc lỗi) — khác 'tileload'/'tileerror' vốn bắn RIÊNG cho TỪNG tile, xen kẽ không
    // theo thứ tự khi nhiều tile tải song song (tile cache trả về ngay, tile khác đang chờ
    // mạng). Bản trước gán thẳng tileError.value trong 'tileload'/'tileerror' — mỗi lần
    // NHIỀU tile hoàn tất đan xen nhau, ref bật/tắt liên tục trong CÙNG một lượt zoom, mỗi
    // lần đổi giá trị là 1 toast xếp hàng ở toastStore (CLAUDE.md Mục 15 kiểu lỗi tương tự:
    // hàng chục tile lỗi/thành công xen kẽ → hàng chục toast tồn đọng, phát nối tiếp nhau
    // rất lâu SAU KHI mạng đã ổn định trở lại — bài học từ lỗi thật đã gặp, xem git log).
    // Đếm lỗi trong một "đợt" (giữa 'loading' và 'load') rồi chỉ gán tileError.value MỘT
    // LẦN khi đợt đó xong mới đúng ý đồ dedupe ban đầu.
    // Cấu hình tile (URL, attribution, crossOrigin, ưu tiên bộ offline z8–10) nằm trong
    // utils/tileLayer.ts — dùng chung với RescueMap.vue, xem giải thích đầy đủ ở đó.
    let coLoiTrongDot = false
    taoLopTileNen()
      .on('loading', () => {
        coLoiTrongDot = false
      })
      .on('tileerror', () => {
        coLoiTrongDot = true
      })
      .on('load', () => {
        tileError.value = coLoiTrongDot
      })
      .addTo(map)

    buildMarkerLayers()
    applyLayerVisibility(map, activeLayer)

    // Ưu tiên ranh giới XÃ/PHƯỜNG (dữ liệu tĩnh, api-contract: không có API ranh giới).
    // Nếu file wards chưa có (đang chờ nhóm cung cấp), fallback về ranh giới TỈNH để
    // bản đồ không trống. Khi có file wards thật, tự động dùng, không cần sửa code.
    try {
      let geojson: unknown
      let laRanhGioiXa = true

      const resWards = await fetch('/data/lamdong-wards.geojson')
      // KHÔNG chỉ kiểm res.ok: khi file không tồn tại, dev server Vite (và mọi host cấu
      // hình SPA fallback) trả về index.html kèm mã 200 chứ không phải 404. res.ok khi đó
      // là true, .json() ném SyntaxError, và nhánh fallback bên dưới KHÔNG BAO GIỜ chạy —
      // mất sạch ranh giới thay vì lùi về ranh giới tỉnh. Phải kiểm cả content-type.
      if (resWards.ok && laJson(resWards)) {
        geojson = await resWards.json()
      } else {
        // Fallback: file xã/phường chưa có → dùng ranh giới tỉnh tạm.
        laRanhGioiXa = false
        const resTinh = await fetch('/lamdong_tinh.geojson')
        if (!resTinh.ok || !laJson(resTinh)) {
          throw new Error(`Không tải được ranh giới (mã ${resTinh.status})`)
        }
        geojson = await resTinh.json()
      }

      // Ghi công nguồn dữ liệu ranh giới ngay trên bản đồ, cạnh attribution của
      // OpenStreetMap (xem public/data/README.md để biết nguồn đầy đủ).
      if (laRanhGioiXa) {
        map.attributionControl.addAttribution('Ranh giới: gis.vn')
      }

      boundaryLayer = L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
        // Ranh giới xã: đường mảnh, nhạt (nhiều vùng). Ranh giới tỉnh: đường đậm hơn.
        style: laRanhGioiXa
          ? { color: '#a8462b', weight: 1, fillColor: '#1f3d2e', fillOpacity: 0.03 }
          : { color: '#a8462b', weight: 2, fillColor: '#1f3d2e', fillOpacity: 0.06 },
        onEachFeature: (feature, layer) => {
          const p = feature.properties ?? {}
          if (laRanhGioiXa) {
            // Tên field tuỳ nguồn dữ liệu wards — thử vài tên phổ biến (ten_xa, TenXa, name...).
            const tenXa = p.ten_xa ?? p.TenXa ?? p.name ?? p.NAME ?? 'Xã/phường'
            const maXa = p.ma_xa ?? p.MaXa ?? p.ward_code ?? ''
            // loai/dtich_km2/dan_so/sap_nhap có sẵn trong nguồn (và khớp đúng các cột của
            // bảng `wards`) nhưng trước đây bị bỏ phí — popup chỉ hiện mỗi tên + mã.
            const dongMoTa = [
              p.loai,
              typeof p.dtich_km2 === 'number'
                ? `${p.dtich_km2.toLocaleString('vi-VN')} km²`
                : null,
              typeof p.dan_so === 'number'
                ? `${p.dan_so.toLocaleString('vi-VN')} dân`
                : null
            ]
              .filter(Boolean)
              .join(' · ')
            layer.bindPopup(
              `<div class="pin-popup"><b>${tenXa}</b>` +
                (dongMoTa ? `<span>${dongMoTa}</span>` : '') +
                (maXa ? `<span>Mã xã: ${maXa}</span>` : '') +
                (p.sap_nhap ? `<span>Sáp nhập từ: ${p.sap_nhap}</span>` : '') +
                `</div>`
            )
          } else {
            const gp = p as GeoJsonProps
            layer.bindPopup(
              `<div class="pin-popup"><b>${gp.TinhThanh}</b>` +
                `<span>${gp.SoXa} xã/phường · ${gp.Dtich_km2.toLocaleString('vi-VN')} km²</span>` +
                `<span>Hợp nhất từ: ${gp.SapNhap}</span></div>`
            )
          }
        }
      }).addTo(map)
      map.fitBounds(boundaryLayer.getBounds(), { padding: [30, 30] })

      // ⚠️ BẮT BUỘC dùng 'zoomend', KHÔNG dùng 'zoom'/'zoomstart'.
      // Trong lúc đang animate zoom, Leaflet cố tình không cho canvas renderer vẽ lại
      // (Canvas._update() thoát sớm khi map._animatingZoom) và kéo giãn cả pane bằng CSS
      // transform trong 250ms. Gọi addLayer/removeLayer giữa lúc đó là ép Leaflet làm thêm
      // việc đúng vào khung thời gian vốn đã không đủ — làm hiện tượng "vỡ hình" khi zoom
      // NẶNG THÊM thay vì nhẹ đi. 'zoomend' chạy sau khi animation kết thúc, an toàn.
      map.on('zoomend', () => capNhatHienThiRanhGioi(map))
      // Áp ngay một lần: fitBounds() ở trên có thể đã đưa map tới mức zoom ≥ ngưỡng
      // (tỉnh nhỏ, màn hình lớn), lúc đó ranh giới phải ẩn ngay chứ không đợi người dùng
      // zoom lần đầu mới đúng trạng thái.
      capNhatHienThiRanhGioi(map)
    } catch (err) {
      console.error(err)
      boundaryError.value =
        'Không tải được lớp ranh giới — kiểm tra file public/data/lamdong-wards.geojson hoặc public/lamdong_tinh.geojson.'
    }

    mapInstance.value = map
    return map
  }

  function destroyMap() {
    // Không cần off('zoomend') thủ công: map.remove() tự gỡ mọi listener gắn trên map.
    mapInstance.value?.remove()
    mapInstance.value = null
    sosOwnMarker = null
    teamMarker = null
    boundaryLayer = null
  }

  return {
    mapInstance,
    soDiemHienThi,
    boundaryError,
    tileError,
    initMap,
    applyLayerVisibility,
    themMarkerBaoCao,
    capNhatMarkerSosCuaMinh,
    capNhatMarkerDoiCuuHo,
    destroyMap
  }
}
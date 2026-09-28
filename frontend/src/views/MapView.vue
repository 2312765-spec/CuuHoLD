<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isAxiosError } from 'axios'
import 'leaflet/dist/leaflet.css'
import '@/assets/map-style.css'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useSocket } from '@/composables/useSocket'
import { useMapDataStore } from '@/stores/mapData'
import { useToastStore } from '@/stores/toast'
import { useOfflineQueueStore } from '@/stores/offlineQueue'
import { layViTriHienTai } from '@/utils/geolocation'
import { CONFIG } from '@/config'
import type { MapLayerKey } from '@/types'
import MapTopBar from '@/components/map/MapTopBar.vue'
import MapStats from '@/components/map/MapStats.vue'
import MapLegend from '@/components/map/MapLegend.vue'
import SosButton from '@/components/sos/SosButton.vue'
import SosConfirmDialog from '@/components/sos/SosConfirmDialog.vue'
import SosTrackerPanel from '@/components/sos/SosTrackerPanel.vue'
import AuthModal from '@/components/AuthModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useSos } from '@/composables/useSos'
import { dinhKemAnhSos } from '@/services/sosService'
import { useGhimViTri } from '@/composables/useGhimViTri'
import { SOS_STATUS_LABEL } from '@/constants/sosLabels'
import type { SosType } from '@/types'
import type { SosUpdatedPayload } from '@/shared/socket-events.types'

const authStore = useAuthStore()
// Nút SOS chỉ dành cho người dân (victim). Rescuer/commander không gửi SOS.
const laVictim = computed(() => authStore.role === 'victim')
// GET /api/rescue-teams (RolesGuard) chỉ cho rescuer/commander — victim gọi vào LUÔN nhận
// 403 "Không có quyền truy cập" (roles.guard.ts). Trước đây điều kiện gọi chỉ kiểm
// isLoggedIn (chặn đúng ca 401 "chưa đăng nhập") mà quên mất route còn giới hạn theo role,
// nên mọi victim đăng nhập vào /map đều thấy toast lỗi này dù không có gì thật sự sai.
const coTheXemDoiCuuHo = computed(
  () => authStore.role === 'rescuer' || authStore.role === 'commander'
)

// ---------- Modal đăng nhập/đăng ký (chồng lên map) ----------
const isAuthOpen = ref(false)

// ---------- Theo dõi + huỷ SOS vừa gửi (CLAUDE.md Mục 10 — 3 phút huỷ miễn phạt) ----------
// Đếm ngược + nhãn hiển thị đã chuyển vào SosTrackerPanel.vue (thuần trình diễn) — ở đây
// chỉ còn giữ state (useSos) và orchestrate (socket, marker, offline queue).
const sos = useSos()

// Nút SOS nổi có đang hiện hay không. Dùng cho CẢ v-if của nút lẫn class .co-nut-sos trên
// .map-page — nút chiếm nguyên góc dưới phải nên các huy hiệu ở đó phải nhường chỗ, và chỉ
// nhường đúng lúc nút thật sự có mặt (xem map-style.css).
const coNutSos = computed(
  () =>
    laVictim.value &&
    !sos.dangHoatDong.value &&
    !sos.dangGui.value &&
    !dangLayViTri.value &&
    !dangGhimBaoHo.value
)

// Trạng thái chờ GPS khoá vệ tinh (enableHighAccuracy có thể mất tới ~15s, xem
// utils/geolocation.ts) — trước đây không có gì hiển thị trong lúc này, giờ tăng timeout lên
// 15s mà không báo gì thì người dùng sẽ tưởng máy treo giữa lúc khẩn cấp.
const dangLayViTri = ref(false)

// ---------- Dialog chọn lý do huỷ ----------
const isCancelDialogOpen = ref(false)
function moCancelDialog() {
  isCancelDialogOpen.value = true
}
async function xacNhanHuySos(reason: 'mistake' | 'resolved_myself' | 'other') {
  isCancelDialogOpen.value = false
  const localId = sos.activeSos.value?.localId
  if (localId) {
    // SOS còn nằm trong hàng đợi offline, chưa từng tới server — không có gì để gọi API
    // huỷ, chỉ cần bỏ khỏi hàng đợi cục bộ là xong.
    await offlineQueueStore.xoaSosKhoiHangDoi(localId)
    sos.dongTheoDoi()
    toastStore.showToast('Đã huỷ yêu cầu đang chờ mạng (chưa từng gửi lên server).')
    return
  }
  try {
    const result = await sos.huyYeuCauSos(reason)
    if (result) {
      toastStore.showToast(
        result.penaltyApplied
          ? 'Đã huỷ yêu cầu — quá hạn 3 phút nên bị tính là huỷ trễ.'
          : 'Đã huỷ yêu cầu, không bị tính phạt.'
      )
      // Trước đây accountFlagged bị bỏ qua hoàn toàn ở FE — victim huỷ trễ lần thứ 3 bị
      // đánh dấu tài khoản mà không hề biết (server đã tính từ lâu, chỉ thiếu hiển thị).
      // toastStore xếp hàng đợi nên gọi thêm lần nữa không mất toast phía trên.
      if (result.accountFlagged) {
        toastStore.showToast(
          'Cảnh báo: tài khoản của bạn đã huỷ trễ nhiều lần và bị đánh dấu.',
          4500
        )
      }
    }
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  }
}

// ---------- Luồng gửi SOS thật (nối SosButton → useSos) ----------
const isSosDialogOpen = ref(false)
function moSosDialog() {
  isSosDialogOpen.value = true
}

// ---------- F-SOS-07: báo SOS hộ người khác (ghim vị trí bằng tay) ----------
// Người báo thường KHÔNG đứng tại chỗ người gặp nạn (thấy từ xa, được gọi điện nhờ...), nên
// dùng GPS máy mình là sai chỗ. Luồng: bấm "Báo hộ" → ghim trên bản đồ → dialog xác nhận
// sẵn có (chọn loại, ảnh, đếm ngược) → gửi với toạ độ đã ghim.
const dangGhimBaoHo = ref(false)
const guiBaoHo = ref(false)
function batDauBaoHo() {
  dangGhimBaoHo.value = true
}
function huyBaoHo() {
  dangGhimBaoHo.value = false
  guiBaoHo.value = false
}
function tiepTucBaoHo() {
  if (!ghim.viTriGhim.value) return
  guiBaoHo.value = true
  isSosDialogOpen.value = true
}
function dongSosDialog() {
  isSosDialogOpen.value = false
  // Đóng dialog lúc đang báo hộ → quay lại bước ghim (giữ nguyên ghim), không thoát hẳn.
  guiBaoHo.value = false
}
async function xacNhanGuiSos(payload: { type: SosType; description: string; anh?: Blob }) {
  isSosDialogOpen.value = false
  if (guiBaoHo.value && ghim.viTriGhim.value) {
    const { lat, lng } = ghim.viTriGhim.value
    const moTa = `[Báo hộ — vị trí do người báo ghim trên bản đồ] ${payload.description}`.trim()
    huyBaoHo()
    // Ghim tay luôn là vị trí ƯỚC LƯỢNG (người báo chọn bằng mắt trên bản đồ) — gắn cờ để
    // rescuer/commander thấy cảnh báo "vị trí ước tính", cùng nguyên tắc P0 ở CLAUDE.md 15.6.
    await guiSosVoiViTri({ lat, lng, uocLuong: true }, { ...payload, description: moTa })
    return
  }
  // Lấy vị trí hiện tại của người dùng qua trình duyệt; nếu từ chối/timeout, dùng tâm tỉnh
  // làm ước tính TẠM (uocLuong=true) — KHÔNG được âm thầm gửi toạ độ giả mà không báo (từng
  // là lỗi P0 an toàn thật, xem CLAUDE.md Mục 15: dialog xác nhận nói "vị trí hiện tại của
  // bạn sẽ được gửi" trong khi thực ra gửi toạ độ bịa, không ai biết để xử lý dự phòng).
  dangLayViTri.value = true
  const viTri = await layViTriHienTai(navigator.geolocation)
  dangLayViTri.value = false
  if (viTri.uocLuong) {
    // uocLuong giờ bật cho CẢ 2 case: GPS lỗi hẳn (dùng tâm tỉnh) LẪN GPS trả toạ độ thật
    // nhưng sai số quá lớn (xem utils/geolocation.ts) — câu chữ không được khẳng định cứng
    // "tâm tỉnh" vì ở case sau toạ độ gửi đi vẫn là vị trí thật, chỉ là kém tin cậy.
    // Trang mở qua http:// (VD: http://192.168.x.x khi test trên điện thoại cùng Wi-Fi) thì
    // trình duyệt CHẶN HẲN Geolocation API dù máy đã bật GPS — báo đúng nguyên nhân thay vì
    // câu chung chung khiến người dùng tưởng GPS hỏng.
    toastStore.showToast(
      window.isSecureContext
        ? 'Không xác định được vị trí GPS chính xác — đã gửi kèm cảnh báo vị trí ước tính. Hãy mô tả rõ vị trí thật hoặc gọi trực tiếp trung tâm nếu có thể.'
        : 'Trình duyệt chặn định vị vì trang không mở bằng https:// — đã gửi kèm cảnh báo vị trí ước tính. Hãy mô tả rõ vị trí thật hoặc gọi trực tiếp trung tâm.'
    )
  }
  await guiSosVoiViTri(viTri, payload)
}

async function guiSosVoiViTri(
  viTri: { lat: number; lng: number; uocLuong: boolean },
  payload: { type: SosType; description: string; anh?: Blob }
) {
  try {
    const daTao = await sos.guiYeuCauSos({
      lat: viTri.lat,
      lng: viTri.lng,
      type: payload.type,
      description: payload.description,
      locationEstimated: viTri.uocLuong
    })
    toastStore.showToast('Đã gửi tín hiệu cứu trợ. Đội điều phối sẽ liên hệ sớm.')
    // F-SOS-06: ảnh gửi SAU, không await — SOS đã tới trung tâm rồi, ảnh chậm/lỗi không được
    // giữ chân hay làm hỏng luồng chính (CLAUDE.md Mục 15.14).
    if (payload.anh) void guiAnhSauSos(daTao.id, payload.anh)
  } catch (err) {
    if (isAxiosError(err) && !err.response) {
      // Mất mạng thật sự (không phải lỗi nghiệp vụ như rate-limit 429/400) — lưu lại để
      // tự gửi ngay khi có mạng, thay vì để yêu cầu cứu trợ biến mất im lặng.
      const localId = crypto.randomUUID()
      // Lưu vào IndexedDB TRƯỚC rồi mới dựng thẻ theo dõi: nếu lưu thất bại, thẻ theo dõi
      // và toast "đã lưu yêu cầu" sẽ là lời hứa suông với người đang cần cứu hộ.
      await offlineQueueStore.themSosVaoHangDoi({
        localId,
        lat: viTri.lat,
        lng: viTri.lng,
        type: payload.type,
        description: payload.description,
        locationEstimated: viTri.uocLuong,
        taoLuc: new Date().toISOString()
      })
      sos.datSosChoGui({ localId, lat: viTri.lat, lng: viTri.lng, type: payload.type, locationEstimated: viTri.uocLuong })
      // Hàng đợi offline chỉ giữ SOS (IndexedDB giữ ảnh vài trăm KB cho mỗi SOS chờ là không
      // đáng rủi ro đầy bộ nhớ máy yếu) — nói thẳng là ảnh không đi kèm, đừng hứa suông.
      toastStore.showToast(
        payload.anh
          ? 'Không có mạng — đã lưu yêu cầu (không kèm ảnh), sẽ tự gửi ngay khi có mạng trở lại.'
          : 'Không có mạng — đã lưu yêu cầu, sẽ tự gửi ngay khi có mạng trở lại.'
      )
    }
    // Lỗi nghiệp vụ khác (VD: vượt 5 SOS/giờ) đã có toast riêng từ interceptor http.ts.
  }
}
async function guiAnhSauSos(sosId: string, anh: Blob) {
  try {
    await dinhKemAnhSos(sosId, anh)
    toastStore.showToast('Đã gửi kèm ảnh hiện trường.')
  } catch {
    // http.ts đã hiện toast lý do lỗi; nhắc thêm rằng SOS vẫn an toàn để người dùng khỏi hoảng.
    toastStore.showToast('Tín hiệu SOS đã gửi thành công — chỉ riêng ảnh chưa gửi được.')
  }
}
const route = useRoute()
const activeLayer = computed<MapLayerKey>(() => (route.query.layer as MapLayerKey) || 'ranh-gioi')

const mapDataStore = useMapDataStore()
const toastStore = useToastStore()
const offlineQueueStore = useOfflineQueueStore()

const {
  mapInstance,
  boundaryError,
  tileError,
  initMap,
  applyLayerVisibility,
  themMarkerBaoCao,
  capNhatMarkerSosCuaMinh,
  capNhatMarkerDoiCuuHo,
  layKhungTinh,
  destroyMap
} = useLeafletMap()
const ghim = useGhimViTri(mapInstance, dangGhimBaoHo, layKhungTinh)

watch(boundaryError, (msg) => {
  if (msg) toastStore.showToast(msg)
})

// Tile nền OSM lỗi (mất mạng, OSM chặn...) — marker SOS/đội/ranh giới đều là vector nên
// vẫn đúng vị trí, chỉ nền raster bị thiếu. Không báo trước thì người xem tự suy diễn
// "hệ thống hỏng" thay vì đúng bản chất "chỉ mất ảnh nền" — cùng nguyên tắc với cảnh báo
// GPS ước lượng (CLAUDE.md Mục 15.6).
watch(tileError, (loi) => {
  if (loi) toastStore.showToast('Không tải được nền bản đồ — vị trí các marker vẫn chính xác')
})

function apDungMarkerSos(): void {
  const active = sos.activeSos.value
  capNhatMarkerSosCuaMinh(
    active && {
      lat: active.lat,
      lng: active.lng,
      status: active.status,
      label: SOS_STATUS_LABEL[active.status]
    }
  )
  // Đội được giao đang tới — chỉ khi SOS chưa kết thúc, để không giữ lại chấm đội cũ sau khi
  // đã hoàn tất/huỷ (poll dừng lúc đó nên toạ độ sẽ đứng yên, gây hiểu nhầm là đội còn đó).
  const teamLat = active?.teamLat
  const teamLng = active?.teamLng
  capNhatMarkerDoiCuuHo(
    sos.dangHoatDong.value && teamLat != null && teamLng != null
      ? { lat: teamLat, lng: teamLng }
      : null
  )
}

// Vẽ/xoá marker SOS của chính victim mỗi khi trạng thái theo dõi đổi (gửi mới, cập nhật
// qua socket/polling, huỷ, hoặc đóng thẻ theo dõi). deep:true vì useSos.ts sửa .status
// ngay trên object cũ (không gán lại activeSos.value) nên watch nông sẽ không bắt được.
watch(() => sos.activeSos.value, apDungMarkerSos, { deep: true, immediate: true })

// ---------- Socket.IO — cập nhật thời gian thực ----------
// TẠM THỜI (Phase 5.3/5.4 sẽ hoàn thiện): lắng nghe sự kiện SOS thật. Hiện chỉ hiện toast
// thông báo; việc vẽ marker SOS lên bản đồ sẽ nối khi mapData store đã đổi sang sosRequests.
const { isConnected, connect } = useSocket({
  onSosNew: (data) => {
    toastStore.showToast(`Có yêu cầu cứu trợ mới tại khu vực ${data.wardCode}`)
  },
  onSosUpdated: (data: SosUpdatedPayload) => {
    // Đúng SOS mình đang theo dõi → cập nhật thẻ theo dõi thay vì chỉ hiện toast chung chung.
    const laSosCuaMinh = sos.capNhatTuSocket(data)
    if (laSosCuaMinh) {
      toastStore.showToast(`Yêu cầu của bạn chuyển sang trạng thái: ${SOS_STATUS_LABEL[data.status]}`)
    } else {
      toastStore.showToast(`Yêu cầu ${data.sosId.slice(0, 8)} chuyển trạng thái: ${SOS_STATUS_LABEL[data.status]}`)
    }
  },
  onTeamLocation: (data) => {
    // Đội cứu hộ gửi vị trí mới → nếu là đội của SOS mình đang theo dõi, đánh dấu "đang di chuyển".
    sos.danhDauDoiDiChuyen(data.teamId)
  }
})

// ---------- Đồng bộ state theo phiên đăng nhập ----------
// Mọi thứ thuộc về PHIÊN (SOS đang theo dõi, marker của nó, kết nối socket mang JWT) phải
// được dựng lại/dọn đi mỗi lần phiên đổi — chứ không chỉ một lần lúc mount như trước. Trước
// đây toàn bộ đoạn này nằm thẳng trong onMounted nên đăng nhập/đăng xuất ngay tại /map
// không kích hoạt lại gì cả: đăng nhập xong marker + thẻ theo dõi không hiện (phải F5), còn
// đăng xuất thì marker + thẻ theo dõi của người vừa đăng xuất vẫn nằm nguyên trên màn hình.
async function khoiTaoTheoRole(): Promise<void> {
  // Nối lại socket bằng JWT hiện tại (useSocket.ts tự ngắt kết nối cũ mang token cũ, và tự
  // bỏ qua nếu vừa đăng xuất — không còn token thì gateway cũng đá ra ngay).
  connect(CONFIG.socketUrl)

  // Dọn state của phiên TRƯỚC trước khi khôi phục phiên mới. Bắt buộc: activeSos chỉ sống
  // trong RAM nên nếu victim A đăng xuất rồi B đăng nhập trên cùng máy, SOS của A vẫn hiển
  // thị nguyên cho B. watch(activeSos) ở trên sẽ tự xoá marker theo.
  sos.dongTheoDoi()

  // Khôi phục SOS đang hoạt động của victim (nếu có) — sau F5 hoặc sau khi vừa đăng nhập
  // (CLAUDE.md Mục 15.4). Chỉ gọi với role victim vì endpoint chỉ dành cho role đó.
  if (laVictim.value) {
    await sos.khoiPhucSosDangHoatDong()
    // Server không có SOS active nào — có thể vì SOS vừa gửi lúc mất mạng chưa từng tới
    // server, vẫn đang nằm chờ trong IndexedDB. Không khôi phục lại thì badge "đang chờ
    // mạng" vẫn đúng (đọc từ IndexedDB) nhưng thẻ theo dõi + đếm ngược biến mất im lặng.
    if (!sos.activeSos.value) {
      const dangCho = await offlineQueueStore.laySosDangChoGuiGanNhat()
      if (dangCho) {
        sos.datSosChoGui({
          localId: dangCho.localId,
          lat: dangCho.lat,
          lng: dangCho.lng,
          type: dangCho.type,
          locationEstimated: dangCho.locationEstimated,
          taoLuc: dangCho.taoLuc
        })
      }
    }
  }
  // initMap() chạy async (chờ tải ranh giới) — nếu state SOS đổi ngay lúc đó, watch ở trên
  // đã bỏ qua vì mapInstance chưa sẵn sàng. Áp lại một lần nữa cho chắc sau khi map đã có.
  apDungMarkerSos()
}

// ---------- Khởi tạo / dọn dẹp bản đồ theo vòng đời component ----------
// Chặn watcher bên dưới chạy trước khi mount xong: lần khởi tạo đầu tiên do onMounted lo
// (nó đọc trạng thái đăng nhập tại thời điểm chạy nên đã bao luôn ca người dùng bấm đăng
// nhập trong lúc initMap còn đang tải ranh giới).
let daKhoiTaoLanDau = false
// Hàm gỡ listener online/offline mà offlineQueueStore.khoiTao() đăng ký — phải gọi lúc
// unmount, nếu không mỗi lần vào lại /map là chồng thêm một listener nữa.
let huyLangNgheHangDoi: (() => void) | null = null

onMounted(async () => {
  await initMap('map', activeLayer.value)
  await khoiTaoTheoRole()
  // Danh sách đội cứu hộ (GET /api/rescue-teams) CẦN đăng nhập (JWT) VÀ role rescuer/commander
  // (RolesGuard) — chỉ tải khi đủ cả hai, tránh gọi API vô ích luôn nhận 401 (khách) hoặc 403
  // (victim đã đăng nhập) rồi hiện toast lỗi cho người chỉ muốn xem map.
  if (coTheXemDoiCuuHo.value) mapDataStore.taiDiemCuuTroTuServer()
  // Khi có mạng trở lại: báo cáo minh hoạ trong hàng đợi được "gửi" theo đúng luồng
  // themMarkerBaoCao() có sẵn (tái dùng, không viết logic vẽ marker riêng lần 2); SOS thật
  // trong hàng đợi được gửi qua guiSos() thật, kết quả đổ ngược lại thẻ theo dõi hiện tại.
  huyLangNgheHangDoi = offlineQueueStore.khoiTao(
    (baoCao) => themMarkerBaoCao(baoCao, activeLayer.value),
    (ketQua, goc) => sos.ghiNhanKetQuaThatTuHangDoi(ketQua, goc.lat, goc.lng)
  )
  daKhoiTaoLanDau = true
})

// Theo dõi thẳng store thay vì bắt sự kiện từ các nút: đổi phiên có thể tới từ modal đăng
// nhập, nút đăng xuất trên thanh trên cùng, HOẶC từ interceptor 401 trong services/http.ts
// tự đăng xuất khi token hết hạn — ca cuối không có nút nào để phát sự kiện, nên cách bắt
// sự kiện sẽ bỏ sót đúng nó. Store là nguồn sự thật duy nhất nên watch ở đây bao hết.
// Watch theo user?.id (giá trị nguyên thuỷ) chứ không watch cả object: fetchMe() lúc khởi
// động gán lại user mới cùng id, watch object sẽ chạy lại thừa một lần vô ích.
watch(
  () => authStore.user?.id,
  () => {
    if (!daKhoiTaoLanDau) return
    void khoiTaoTheoRole()
    // Đăng nhập giữa chừng (đang ở /map) bằng tài khoản rescuer/commander → giờ mới có token
    // + đúng role, tải danh sách đội cứu hộ. Đăng xuất, hoặc đăng nhập bằng victim → không
    // gọi (tránh 401/403 như đã sửa ở onMounted).
    if (coTheXemDoiCuuHo.value) mapDataStore.taiDiemCuuTroTuServer()
  }
)

onUnmounted(() => {
  destroyMap()
  huyLangNgheHangDoi?.()
  huyLangNgheHangDoi = null
})

// Đổi tab lớp (?layer=...) không cần tải lại trang — chỉ cập nhật marker đang hiện.
watch(activeLayer, (layer) => {
  if (mapInstance.value) applyLayerVisibility(mapInstance.value, layer)
})
</script>

<template>
  <div class="map-page" :class="{ 'co-nut-sos': coNutSos }">
    <MapTopBar @open-auth="isAuthOpen = true" />
    <MapStats />
    <div id="map"></div>
    <MapLegend />
    <!-- Nút SOS nổi — chỉ hiện cho người dân (victim). Ẩn khi có SOS chưa kết thúc HOẶC
         đang chờ response gửi (dangGui) — thiếu vế sau từng là race condition thật: dialog
         đóng ngay lúc bấm "Gửi ngay" nhưng dangHoatDong chỉ true SAU khi API trả về, nên
         trong lúc mạng chậm nút SOS hiện lại được và bấm gửi trùng lần 2. -->
    <div v-if="coNutSos" class="sos-fab">
      <button type="button" class="bao-ho-btn" @click="batDauBaoHo">Báo hộ người khác</button>
      <SosButton @open="moSosDialog" />
    </div>
    <!-- F-SOS-07: thanh hướng dẫn trong lúc ghim vị trí báo hộ -->
    <section v-if="dangGhimBaoHo && !isSosDialogOpen" class="bao-ho-panel" aria-labelledby="bao-ho-title">
      <div class="bao-ho-panel__head">
        <h2 id="bao-ho-title">Báo SOS hộ người khác</h2>
        <button type="button" class="bao-ho-panel__dong" aria-label="Thoát chế độ báo hộ" @click="huyBaoHo">✕</button>
      </div>
      <p v-if="!ghim.viTriGhim.value" class="bao-ho-panel__huong-dan">
        Chạm vào bản đồ tại nơi người cần cứu đang ở. Có thể kéo ghim để chỉnh lại.
      </p>
      <p v-else class="bao-ho-panel__huong-dan">
        Đã ghim: {{ ghim.viTriGhim.value.lat.toFixed(5) }}, {{ ghim.viTriGhim.value.lng.toFixed(5) }}
      </p>
      <p v-if="ghim.loiGhim.value" class="bao-ho-panel__loi" role="alert">{{ ghim.loiGhim.value }}</p>
      <div class="bao-ho-panel__nut">
        <button type="button" class="btn btn-ghost" @click="ghim.ghimTaiTamBanDo">Ghim tại tâm bản đồ</button>
        <button type="button" class="btn sos-confirm-btn" :disabled="!ghim.viTriGhim.value" @click="tiepTucBaoHo">
          Tiếp tục
        </button>
      </div>
    </section>
    <SosConfirmDialog
      :is-open="isSosDialogOpen"
      :bao-ho="guiBaoHo"
      @cancel="dongSosDialog"
      @confirm="xacNhanGuiSos"
    />

    <!-- Thẻ theo dõi SOS vừa gửi — xem trạng thái + huỷ trong 3 phút không bị tính phạt -->
    <SosTrackerPanel
      v-if="sos.activeSos.value"
      :active-sos="sos.activeSos.value"
      :dang-hoat-dong="sos.dangHoatDong.value"
      :dang-huy="sos.dangHuy.value"
      @huy="moCancelDialog"
      @dong="sos.dongTheoDoi"
    />

    <!-- Dialog chọn lý do huỷ -->
    <div class="modal-overlay" :class="{ open: isCancelDialogOpen }" @click.self="isCancelDialogOpen = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Vì sao bạn muốn huỷ?</h3>
          <button class="modal-close" @click="isCancelDialogOpen = false">✕</button>
        </div>
        <div class="modal-actions" style="flex-direction: column; align-items: stretch;">
          <button class="btn btn-ghost" @click="xacNhanHuySos('mistake')">Gửi nhầm</button>
          <button class="btn btn-ghost" @click="xacNhanHuySos('resolved_myself')">Đã tự xử lý được</button>
          <button class="btn btn-ghost" @click="xacNhanHuySos('other')">Lý do khác</button>
        </div>
      </div>
    </div>
    <!-- Chỉ hiện khi đã đăng nhập: khách vãng lai không được phép mở kết nối socket (gateway
         verify JWT rồi disconnect ngay), nên báo "chưa kết nối" với họ là báo động giả —
         khiến người ta tưởng hệ thống hỏng đúng lúc cần tin tưởng nó nhất. -->
    <div v-if="authStore.isLoggedIn" class="socket-status" :class="{ connected: isConnected }">
      <span class="dot"></span>{{ isConnected ? 'Cập nhật thời gian thực: đang bật' : 'Cập nhật thời gian thực: chưa kết nối' }}
    </div>
    <div v-if="dangLayViTri" class="gps-status">
      <span class="dot"></span>Đang xác định vị trí GPS chính xác...
    </div>
    <div v-if="offlineQueueStore.soLuongChoGui > 0" class="offline-badge">
      <span class="dot"></span>{{ offlineQueueStore.soLuongChoGui }} báo cáo đang chờ gửi
    </div>
    <div v-if="offlineQueueStore.soLuongSosChoGui > 0" class="offline-badge offline-badge--sos">
      <span class="dot"></span>{{ offlineQueueStore.soLuongSosChoGui }} yêu cầu SOS đang chờ mạng
    </div>
    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
    <AuthModal :is-open="isAuthOpen" @close="isAuthOpen = false" @logged-in="isAuthOpen = false" />
  </div>
</template>
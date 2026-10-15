<script setup lang="ts">
// Nút "Vị trí của tôi" + bảng thông tin nhỏ, đặt vào một control Leaflet (Teleport vào khung
// control) — Leaflet tự xếp nó ngay dưới nút zoom cùng góc, nên không bao giờ đè nút zoom dù
// mỗi màn đặt zoom ở góc khác nhau. Logic nằm trong composables/useViTriCuaToi.ts.
import { computed, shallowRef, toRaw, toRef, watch, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import { useViTriCuaToi } from '@/composables/useViTriCuaToi'
import type { DiemGps } from '@/utils/locViTri'

const props = withDefaults(
  defineProps<{
    map: L.Map | null
    // Điểm GPS từ watcher có sẵn của màn (RescuerView). Không truyền = tự xin vị trí.
    nguonNgoai?: DiemGps | null
    viTriControl?: L.ControlPosition
  }>(),
  { nguonNgoai: undefined, viTriControl: 'topleft' }
)

// toRaw: nơi truyền vào có thể bọc map trong reactive() (đã gặp khi mount qua test-utils) —
// Leaflet thao tác qua proxy phản ứng thì lớp vẽ và bản đồ gốc lệch nhau (canvas vẽ lại sau
// khi bản đồ đã huỷ). Đối tượng Leaflet luôn dùng bản gốc.
const mapGoc = computed(() => (props.map ? toRaw(props.map) : null))

const viTri = useViTriCuaToi(
  mapGoc,
  props.nguonNgoai === undefined ? undefined : toRef(props, 'nguonNgoai')
)
const { daBat, dangLay, loi, dangTheoDoi, dangChinh, doChinhXacThap, viTriChinhTay } = viTri

const khung = shallowRef<HTMLElement | null>(null)
let control: L.Control | null = null

watch(
  mapGoc,
  (m) => {
    control?.remove()
    control = null
    khung.value = null
    if (!m) return
    const c = new L.Control({ position: props.viTriControl })
    c.onAdd = () => {
      const el = L.DomUtil.create('div', 'vi-tri-control')
      // Chạm vào bảng không được lọt xuống bản đồ (kéo/zoom/đặt ghim báo hộ).
      L.DomEvent.disableClickPropagation(el)
      L.DomEvent.disableScrollPropagation(el)
      return el
    }
    c.addTo(m)
    control = c
    khung.value = c.getContainer() ?? null
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  control?.remove()
  control = null
})
</script>

<template>
  <Teleport v-if="khung" :to="khung">
    <div class="vi-tri">
      <button
        type="button"
        class="vi-tri__nut"
        :class="{ 'is-active': daBat }"
        aria-label="Vị trí của tôi"
        title="Vị trí của tôi"
        @click="viTri.bamNut"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" />
        </svg>
      </button>

      <div v-if="daBat" class="vi-tri__bang">
        <p v-if="dangLay" class="vi-tri__dong" aria-live="polite">Đang lấy vị trí…</p>
        <p v-if="loi" class="vi-tri__loi" role="alert">{{ loi }}</p>
        <template v-if="viTri.viTri.value">
          <p v-if="viTriChinhTay" class="vi-tri__dong vi-tri__dong--dam">Vị trí đã chỉnh tay (không phải GPS)</p>
          <p v-else-if="viTri.viTri.value.saiSoM !== null" class="vi-tri__dong vi-tri__dong--dam">
            ±{{ Math.round(viTri.viTri.value.saiSoM) }} m
          </p>
          <p v-if="!viTriChinhTay && doChinhXacThap" class="vi-tri__canh-bao">
            Độ chính xác thấp — vị trí có thể lệch xa. Ra chỗ thoáng để GPS bắt tốt hơn.
          </p>
          <label class="vi-tri__theo-doi">
            <input type="checkbox" :checked="dangTheoDoi" @change="viTri.batTatTheoDoi" />
            Theo dõi
          </label>
          <div class="vi-tri__nhom-nut">
            <button type="button" @click="viTri.batTatChinhTay">{{ dangChinh ? 'Xong' : 'Chỉnh vị trí' }}</button>
            <button v-if="viTriChinhTay" type="button" @click="viTri.boChinhTay">Dùng lại GPS</button>
          </div>
        </template>
        <p class="vi-tri__ghi-chu">Vị trí chỉ hiển thị trên máy bạn, chưa gửi đi đâu.</p>
        <button type="button" class="vi-tri__tat" @click="viTri.tat">Tắt</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Bảng luôn nền trắng chữ tối — cả ở dark mode (bản đồ là nền sáng), color-scheme light để ô
   tick cũng sáng. Vùng chạm ≥ 44px, chữ ≥ 14px. */
.vi-tri {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  color: #2a2a24;
  color-scheme: light;
  font-family: 'Inter', sans-serif;
}
.vi-tri__nut {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background: #ffffff;
  color: #1f3d2e;
  cursor: pointer;
}
.vi-tri__nut.is-active {
  color: #1d4ed8;
}
.vi-tri__nut:focus-visible,
.vi-tri__bang button:focus-visible,
.vi-tri__theo-doi input:focus-visible {
  outline: 3px solid #1f3d2e;
  outline-offset: 2px;
}
.vi-tri__bang {
  display: grid;
  gap: 4px;
  width: min(240px, calc(100vw - 80px));
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
  font-size: 14px;
  line-height: 1.4;
}
.vi-tri__dong {
  margin: 0;
}
.vi-tri__dong--dam {
  font-weight: 600;
}
.vi-tri__loi {
  margin: 0;
  color: #9a3412;
}
.vi-tri__canh-bao {
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fef3c7;
  color: #78350f;
}
.vi-tri__ghi-chu {
  margin: 0;
  color: #4b4b44;
}
.vi-tri__theo-doi {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
}
.vi-tri__theo-doi input {
  width: 20px;
  height: 20px;
  accent-color: #1f3d2e;
}
.vi-tri__nhom-nut {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vi-tri__bang button {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(42, 42, 36, 0.4);
  border-radius: 8px;
  background: #ffffff;
  color: #2a2a24;
  font: inherit;
  cursor: pointer;
}
.vi-tri__bang .vi-tri__tat {
  justify-self: end;
}
</style>

<style>
/* Ghim chỉnh tay — không scoped vì Leaflet tự tạo phần tử icon ngoài component. */
.vi-tri-ghim__dau {
  position: absolute;
  left: 3px;
  top: 0;
  width: 24px;
  height: 24px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: #1d4ed8;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
</style>

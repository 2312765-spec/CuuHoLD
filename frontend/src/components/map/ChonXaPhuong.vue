<script setup lang="ts">
// Bộ lọc xã/phường đặt trong khung control của Leaflet (cùng cách với ViTriCuaToi.vue — Leaflet tự
// xếp dưới nút zoom / nút vị trí, không đè lên nhau). Chọn 1 xã → bản đồ bay tới khung bao của xã
// đó (giống nút "Vị trí của tôi" đưa bản đồ tới chỗ mình đứng). v-model là MÃ xã ('' = tất cả) để
// màn cha lọc thêm danh sách nếu cần (Bảng điều phối lọc SOS theo xã).
import { computed, nextTick, ref, shallowRef, toRaw, watch, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import { useXaPhuong } from '@/composables/useXaPhuong'
import { boDau, tenDayDu, type XaPhuong } from '@/utils/xaPhuong'

const props = withDefaults(
  defineProps<{
    map: L.Map | null
    modelValue?: string
    viTriControl?: L.ControlPosition
  }>(),
  { modelValue: '', viTriControl: 'topleft' }
)
const emit = defineEmits<{ 'update:modelValue': [ma: string] }>()

// Đủ gần để thấy đường trong xã, không quá sâu khiến xã lớn chỉ hiện một góc.
const ZOOM_TOI_DA_KHI_BAY = 15

const { danhSachXa, timXa } = useXaPhuong()
const mapGoc = computed(() => (props.map ? toRaw(props.map) : null))

const mo = ref(false)
const tuKhoa = ref('')
const oTim = ref<HTMLInputElement | null>(null)

const xaDangChon = computed(() => timXa(props.modelValue))
const nhanNut = computed(() => (xaDangChon.value ? tenDayDu(xaDangChon.value) : 'Tất cả xã/phường'))

const danhSachLoc = computed(() => {
  const kw = boDau(tuKhoa.value.trim())
  if (!kw) return danhSachXa.value
  return danhSachXa.value.filter((x) => boDau(tenDayDu(x)).includes(kw))
})

function bayToi(x: XaPhuong): void {
  mapGoc.value?.flyToBounds(x.khung, { padding: [24, 24], maxZoom: ZOOM_TOI_DA_KHI_BAY, duration: 0.8 })
}

function chon(x: XaPhuong | null): void {
  emit('update:modelValue', x?.ma ?? '')
  if (x) bayToi(x)
  mo.value = false
  tuKhoa.value = ''
}

async function batTat(): Promise<void> {
  mo.value = !mo.value
  if (mo.value) {
    await nextTick()
    oTim.value?.focus()
  }
}

// Màn cha đổi xã (VD bấm "Xoá lọc") → không cần bay, chỉ đóng bảng nếu đang mở.
watch(
  () => props.modelValue,
  () => {
    mo.value = false
  }
)

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
      const el = L.DomUtil.create('div', 'chon-xa-control')
      // Cuộn danh sách / chạm chọn xã không được lọt xuống làm bản đồ zoom hay đặt ghim.
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
    <div class="chon-xa" @keydown.esc="mo = false">
      <button
        type="button"
        class="chon-xa__nut"
        :class="{ 'is-active': !!xaDangChon }"
        :aria-expanded="mo"
        aria-haspopup="listbox"
        title="Chọn xã/phường để di chuyển bản đồ tới"
        @click="batTat"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
            fill="currentColor"
          />
        </svg>
        <span class="chon-xa__nhan">{{ nhanNut }}</span>
        <span aria-hidden="true">▾</span>
      </button>

      <div v-if="mo" class="chon-xa__bang">
        <input
          ref="oTim"
          v-model="tuKhoa"
          type="search"
          class="chon-xa__tim"
          placeholder="Tìm xã/phường (gõ không dấu được)"
          aria-label="Tìm xã/phường"
        />
        <p v-if="danhSachXa.length === 0" class="chon-xa__trong">Đang tải danh sách xã/phường…</p>
        <ul v-else class="chon-xa__ds" role="listbox" aria-label="Danh sách xã/phường">
          <li v-if="!tuKhoa">
            <button
              type="button"
              role="option"
              :aria-selected="!xaDangChon"
              :class="{ 'is-active': !xaDangChon }"
              @click="chon(null)"
            >
              Tất cả xã/phường
            </button>
          </li>
          <li v-for="x in danhSachLoc" :key="x.ma">
            <button
              type="button"
              role="option"
              :aria-selected="x.ma === modelValue"
              :class="{ 'is-active': x.ma === modelValue }"
              @click="chon(x)"
            >
              {{ tenDayDu(x) }}
            </button>
          </li>
          <li v-if="danhSachLoc.length === 0" class="chon-xa__trong">Không tìm thấy xã/phường nào.</li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Cùng quy ước với ViTriCuaToi: bảng luôn nền trắng chữ tối kể cả dark mode (bản đồ nền sáng),
   vùng chạm ≥ 44px, chữ ≥ 14px. */
.chon-xa {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  color: #2a2a24;
  color-scheme: light;
  font-family: 'Inter', sans-serif;
}
.chon-xa__nut {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  max-width: min(260px, calc(100vw - 80px));
  padding: 0 12px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background: #ffffff;
  color: #1f3d2e;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.chon-xa__nut.is-active {
  border-color: #1d4ed8;
  color: #1d4ed8;
}
.chon-xa__nhan {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chon-xa__nut:focus-visible,
.chon-xa__tim:focus-visible,
.chon-xa__ds button:focus-visible {
  outline: 3px solid #1f3d2e;
  outline-offset: 2px;
}
.chon-xa__bang {
  display: grid;
  gap: 6px;
  width: min(280px, calc(100vw - 80px));
  padding: 10px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
}
.chon-xa__tim {
  width: 100%;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid rgba(42, 42, 36, 0.4);
  border-radius: 8px;
  background: #ffffff;
  color: #2a2a24;
  font: inherit;
  font-size: 14px;
}
.chon-xa__ds {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(320px, 45vh);
  overflow-y: auto;
}
.chon-xa__ds button {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #2a2a24;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.chon-xa__ds button:hover {
  background: #f1ede2;
}
.chon-xa__ds button.is-active {
  background: #dbeafe;
  color: #1e3a8a;
  font-weight: 600;
}
.chon-xa__trong {
  margin: 0;
  padding: 6px 10px;
  color: #4b4b44;
  font-size: 14px;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationStore } from '@/stores/notifications'

// Trung tâm thông báo (F-UI-03). Chuông + badge số chưa đọc ở header, danh sách thả xuống.
// CHỈ hiển thị: việc nghe socket và ghi lịch sử nằm ở NotificationListener.vue (mount ở App.vue,
// chạy ở mọi trang); lịch sử lưu theo tài khoản trong stores/notifications.ts.

const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const store = useNotificationStore()
const { danhSach, soChuaDoc } = storeToRefs(store)
const router = useRouter()

// ---- UI đóng/mở ----
const moRong = ref(false)
function toggle() {
  moRong.value = !moRong.value
  if (moRong.value) store.danhDauTatCa() // mở ra coi như đã đọc hết
}
function dong() { moRong.value = false }

function chonThongBao(sosId?: string) {
  dong()
  // Chỉ commander có Bảng điều phối để xem chi tiết SOS.
  if (sosId && authStore.role === 'commander') router.push('/dashboard')
}

function thoiGianNgan(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'vừa xong'
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

// Thông báo cũ (lưu trước khi có trường icon) rơi về biểu tượng theo loại.
const ICON: Record<string, string> = { 'sos-moi': '🆘', 'sos-capnhat': '🔄', 'he-thong': '📢' }

// Đóng khi bấm ra ngoài.
function onClickNgoai(e: MouseEvent) {
  const el = goc.value
  if (moRong.value && el && !el.contains(e.target as Node)) dong()
}
const goc = ref<HTMLElement | null>(null)
onMounted(() => document.addEventListener('click', onClickNgoai))
onBeforeUnmount(() => document.removeEventListener('click', onClickNgoai))
</script>

<template>
  <div v-if="isLoggedIn" ref="goc" class="noti">
    <button
      class="noti-btn"
      type="button"
      :aria-label="`Thông báo${soChuaDoc ? ' (' + soChuaDoc + ' chưa đọc)' : ''}`"
      @click.stop="toggle"
    >
      <span aria-hidden="true">🔔</span>
      <span v-if="soChuaDoc > 0" class="noti-badge">{{ soChuaDoc > 9 ? '9+' : soChuaDoc }}</span>
    </button>

    <transition name="noti-fade">
      <div v-if="moRong" class="noti-panel" role="menu">
        <div class="noti-head">
          <span>Thông báo</span>
          <button v-if="danhSach.length" class="noti-clear" type="button" @click="store.xoaTatCa()">Xoá hết</button>
        </div>
        <div v-if="danhSach.length === 0" class="noti-empty">Chưa có thông báo nào.</div>
        <ul v-else class="noti-list">
          <li
            v-for="tb in danhSach"
            :key="tb.id"
            class="noti-item"
            :class="{ unread: !tb.daDoc }"
            @click="chonThongBao(tb.sosId)"
          >
            <span class="noti-ico" aria-hidden="true">{{ tb.icon ?? ICON[tb.loai] }}</span>
            <div class="noti-body">
              <div class="noti-title">{{ tb.tieuDe }}</div>
              <div v-if="tb.moTa" class="noti-desc">{{ tb.moTa }}</div>
              <div class="noti-time">{{ thoiGianNgan(tb.thoiGian) }}</div>
            </div>
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.noti { position: relative; display: inline-flex; }
.noti-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.noti-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
.noti-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--clay);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}
.noti-panel {
  position: absolute;
  top: 46px;
  right: 0;
  width: 320px;
  max-width: 86vw;
  max-height: 420px;
  overflow-y: auto;
  background: var(--fog);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(20, 39, 32, 0.22);
  z-index: 3200;
}
.noti-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
  position: sticky;
  top: 0;
  background: var(--fog);
}
.noti-clear {
  border: none;
  background: none;
  color: var(--clay);
  font-size: 12px;
  cursor: pointer;
}
.noti-clear:hover { text-decoration: underline; }
.noti-empty { padding: 26px 14px; text-align: center; color: rgba(42, 42, 36, 0.55); font-size: 13px; }
.noti-list { list-style: none; margin: 0; padding: 0; }
.noti-item {
  display: flex;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background 0.15s ease;
}
.noti-item:hover { background: rgba(42, 42, 36, 0.04); }
.noti-item.unread { background: rgba(200, 122, 86, 0.08); }
.noti-ico { font-size: 16px; line-height: 1.3; flex-shrink: 0; }
.noti-body { min-width: 0; }
.noti-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.noti-desc { font-size: 12px; color: rgba(42, 42, 36, 0.7); margin-top: 1px; }
.noti-time { font-size: 11px; color: rgba(42, 42, 36, 0.5); margin-top: 3px; }
.noti-fade-enter-active, .noti-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.noti-fade-enter-from, .noti-fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
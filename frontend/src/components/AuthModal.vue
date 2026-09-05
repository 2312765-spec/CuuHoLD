<script setup lang="ts">
import { ref } from 'vue'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { register as apiRegister } from '@/services/auth.service'

function layThongBaoLoi(err: unknown): string | null {
  if (!isAxiosError(err)) return null
  const msg = err.response?.data?.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg) && msg.length > 0) return msg[0]
  return null
}

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: []; loggedIn: [] }>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const cheDo = ref<'login' | 'register'>('login')
const phone = ref('')
const password = ref('')
const name = ref('')
const dangGui = ref(false)

async function dangNhap() {
  if (!phone.value || !password.value) {
    toastStore.showToast('Vui lòng nhập số điện thoại và mật khẩu.')
    return
  }
  dangGui.value = true
  try {
    const user = await authStore.login(phone.value, password.value)
    toastStore.showToast(`Xin chào ${user.name}`)
    emit('loggedIn')
    emit('close')
  } catch {
    toastStore.showToast('Sai số điện thoại hoặc mật khẩu.')
  } finally {
    dangGui.value = false
  }
}

async function dangKy() {
  if (!phone.value || !password.value || !name.value) {
    toastStore.showToast('Vui lòng điền đầy đủ thông tin.')
    return
  }
  if (password.value.length < 8) {
    toastStore.showToast('Mật khẩu tối thiểu 8 ký tự.')
    return
  }
  dangGui.value = true
  try {
    const res = await apiRegister({
      phone: phone.value,
      name: name.value,
      password: password.value,
      role: 'victim'
    })
    authStore.setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user })
    toastStore.showToast(`Tạo tài khoản thành công. Xin chào ${res.user.name}`)
    emit('loggedIn')
    emit('close')
  } catch (err) {
    toastStore.showToast(layThongBaoLoi(err) || 'Đăng ký thất bại. Vui lòng thử lại.')
  } finally {
    dangGui.value = false
  }
}

function guiForm() {
  if (dangGui.value) return
  if (cheDo.value === 'login') dangNhap()
  else dangKy()
}
</script>

<template>
  <div class="auth-overlay" :class="{ open: props.isOpen }" @click.self="emit('close')">
    <div class="auth-modal">
      <button class="auth-close" aria-label="Đóng" @click="emit('close')">✕</button>

      <div class="auth-brand">
        <svg class="mark" viewBox="0 0 30 30" fill="none">
          <path d="M2 22L11 8L16 16L20 10L28 22" stroke="#a8462b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="20" cy="10" r="2" fill="#1f3d2e"/>
        </svg>
        <span>Cứu Trợ Lâm Đồng</span>
      </div>

      <div class="auth-tabs">
        <button :class="{ active: cheDo === 'login' }" @click="cheDo = 'login'">Đăng nhập</button>
        <button :class="{ active: cheDo === 'register' }" @click="cheDo = 'register'">Đăng ký</button>
      </div>

      <p class="auth-sub">
        {{ cheDo === 'login' ? 'Đăng nhập để gửi yêu cầu cứu trợ hoặc điều phối.' : 'Tạo tài khoản người dân để gửi tín hiệu cứu trợ.' }}
      </p>

      <label v-if="cheDo === 'register'">Họ tên
        <input v-model="name" type="text" placeholder="Nguyễn Văn A" @keyup.enter="guiForm" />
      </label>
      <label>Tên đăng nhập
        <input v-model="phone" type="tel" inputmode="numeric" placeholder="09xxxxxxxx" @keyup.enter="guiForm" />
      </label>
      <label>Mật khẩu
        <input v-model="password" type="password" placeholder="Tối thiểu 8 ký tự" @keyup.enter="guiForm" />
      </label>
      <button class="btn btn-primary auth-submit" :disabled="dangGui" @click="guiForm">
        {{ dangGui ? 'Đang xử lý...' : (cheDo === 'login' ? 'Đăng nhập' : 'Tạo tài khoản') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay{
  position:fixed; inset:0; z-index:3000; background:rgba(20,39,32,0.5);
  display:none; align-items:center; justify-content:center; padding:20px;
  backdrop-filter:blur(3px);
}
.auth-overlay.open{ display:flex; }
.auth-modal{
  position:relative; width:100%; max-width:390px; background:#fff; border-radius:18px;
  padding:32px 28px; box-shadow:0 24px 60px rgba(0,0,0,0.3);
}
.auth-close{
  position:absolute; top:16px; right:16px; background:none; border:none;
  font-size:16px; cursor:pointer; color:var(--ink); opacity:0.5;
}
.auth-close:hover{ opacity:1; }
.auth-brand{ display:flex; align-items:center; gap:9px; margin-bottom:22px; font-family:'Fraunces',serif; font-weight:600; color:var(--pine-deep); }
.auth-brand .mark{ width:28px; height:28px; }
.auth-tabs{ display:flex; gap:4px; background:var(--fog-dim); border-radius:10px; padding:4px; margin-bottom:18px; }
.auth-tabs button{
  flex:1; padding:9px; border:none; background:transparent; border-radius:7px;
  font-family:'Inter',sans-serif; font-size:14px; font-weight:500; color:rgba(42,42,36,0.6); cursor:pointer; transition:all .15s;
}
.auth-tabs button.active{ background:#fff; color:var(--pine-deep); box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.auth-sub{ font-size:13px; color:rgba(42,42,36,0.6); margin-bottom:22px; }
.auth-modal label{ display:block; font-size:13px; color:var(--ink); margin-bottom:16px; }
.auth-modal input{
  display:block; width:100%; margin-top:6px; padding:11px 13px;
  border:1px solid var(--line); border-radius:9px; font-family:'Inter',sans-serif; font-size:14px;
}
.auth-submit{ width:100%; justify-content:center; margin-top:6px; }
.auth-submit:disabled{ opacity:0.6; cursor:not-allowed; }
</style>
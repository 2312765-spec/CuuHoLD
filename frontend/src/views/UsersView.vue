<script setup lang="ts">
// Quản lý người dùng (commander) — danh sách tài khoản, đổi role, khoá/mở khoá, tạo tài khoản
// mới với role tự chọn (khác /api/auth/register công khai, luôn ép victim — xem
// users.controller.ts). Toàn bộ endpoint /api/users đã bị khoá commander-only ở backend
// (RolesGuard) — trang này chỉ là giao diện gọi vào, không tự kiểm tra quyền gì thêm.

import { ref, computed, onMounted } from 'vue'
import '@/assets/map-style.css'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import {
  layDanhSachNguoiDung,
  taoNguoiDung,
  doiVaiTro,
  doiTrangThaiKhoa
} from '@/services/usersService'
import type { User } from '@/types/auth'
import type { UserRole } from '@/shared/socket-events.types'

const authStore = useAuthStore()
const toastStore = useToastStore()

const ROLE_LABEL: Record<UserRole, string> = {
  victim: 'Người dân',
  rescuer: 'Cứu hộ',
  commander: 'Chỉ huy'
}

// ---------- Danh sách + lọc theo role ----------
const users = ref<User[]>([])
const loading = ref(false)
const locBoLoc = ref<UserRole | 'all'>('all')

async function taiDanhSach(): Promise<void> {
  loading.value = true
  try {
    users.value = await layDanhSachNguoiDung(locBoLoc.value === 'all' ? undefined : locBoLoc.value)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    loading.value = false
  }
}

function doiBoLoc(role: UserRole | 'all'): void {
  locBoLoc.value = role
  void taiDanhSach()
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// ---------- Đổi role / khoá-mở khoá — có confirm vì là thao tác rủi ro (đổi quyền hệ
// thống), dùng window.confirm() cho gọn thay vì xây riêng 1 modal xác nhận cho việc này. ----------
const dangXuLyId = ref<string | null>(null)

async function xuLyDoiVaiTro(user: User, roleMoi: UserRole): Promise<void> {
  if (roleMoi === user.role) return
  if (!window.confirm(`Đổi vai trò "${user.name}" từ ${ROLE_LABEL[user.role]} sang ${ROLE_LABEL[roleMoi]}?`)) {
    return
  }
  dangXuLyId.value = user.id
  try {
    const ketQua = await doiVaiTro(user.id, roleMoi)
    Object.assign(user, ketQua)
    toastStore.showToast(`Đã đổi "${user.name}" sang ${ROLE_LABEL[roleMoi]}`)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: 400 tự đổi role chính mình).
  } finally {
    dangXuLyId.value = null
  }
}

async function xuLyKhoaMoKhoa(user: User): Promise<void> {
  const dangKhoa = user.isActive
  const cauHoi = dangKhoa
    ? `Khoá tài khoản "${user.name}"? Tài khoản sẽ không đăng nhập được nữa.`
    : `Mở khoá tài khoản "${user.name}"?`
  if (!window.confirm(cauHoi)) return

  dangXuLyId.value = user.id
  try {
    const ketQua = await doiTrangThaiKhoa(user.id, !dangKhoa)
    Object.assign(user, ketQua)
    toastStore.showToast(dangKhoa ? `Đã khoá "${user.name}"` : `Đã mở khoá "${user.name}"`)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: 400 tự khoá chính mình).
  } finally {
    dangXuLyId.value = null
  }
}

// ---------- Modal tạo tài khoản mới ----------
const modalOpen = ref(false)
const formPhone = ref('')
const formName = ref('')
const formPassword = ref('')
const formRole = ref<UserRole>('victim')
const formWardCode = ref('')
const dangTao = ref(false)

function moModalTao(): void {
  formPhone.value = ''
  formName.value = ''
  formPassword.value = ''
  formRole.value = 'victim'
  formWardCode.value = ''
  modalOpen.value = true
}

function dongModal(): void {
  modalOpen.value = false
}

async function xuLyTaoTaiKhoan(): Promise<void> {
  if (!formPhone.value || !formName.value || !formPassword.value) {
    toastStore.showToast('Vui lòng điền đầy đủ số điện thoại, tên và mật khẩu.')
    return
  }
  if (formPassword.value.length < 8) {
    toastStore.showToast('Mật khẩu tối thiểu 8 ký tự.')
    return
  }
  dangTao.value = true
  try {
    const nguoiDungMoi = await taoNguoiDung({
      phone: formPhone.value,
      name: formName.value,
      password: formPassword.value,
      role: formRole.value,
      wardCode: formWardCode.value || undefined
    })
    users.value = [nguoiDungMoi, ...users.value]
    toastStore.showToast(`Đã tạo tài khoản "${nguoiDungMoi.name}"`)
    dongModal()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: 409 số điện thoại đã tồn tại).
  } finally {
    dangTao.value = false
  }
}

const tongSoHienThi = computed(() => users.value.length)

onMounted(() => {
  void taiDanhSach()
})
</script>

<template>
  <div class="users-page">
    <header class="users-top">
      <div class="users-top-left">
        <h1>Quản lý người dùng</h1>
        <RouterLink to="/dashboard" class="users-back">← Bảng điều phối</RouterLink>
      </div>
      <div class="users-top-right">
        <span class="users-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
      </div>
    </header>

    <main class="users-body">
      <div class="users-toolbar">
        <div class="users-filter">
          <button :class="{ active: locBoLoc === 'all' }" @click="doiBoLoc('all')">Tất cả</button>
          <button :class="{ active: locBoLoc === 'victim' }" @click="doiBoLoc('victim')">Người dân</button>
          <button :class="{ active: locBoLoc === 'rescuer' }" @click="doiBoLoc('rescuer')">Cứu hộ</button>
          <button :class="{ active: locBoLoc === 'commander' }" @click="doiBoLoc('commander')">Chỉ huy</button>
        </div>
        <button class="btn btn-primary" @click="moModalTao">+ Tạo tài khoản</button>
      </div>

      <div v-if="loading" class="panel-empty">Đang tải...</div>
      <div v-else-if="users.length === 0" class="panel-empty">Không có tài khoản nào.</div>
      <table v-else class="users-table">
        <thead>
          <tr>
            <th>Họ tên / SĐT</th>
            <th>Vai trò</th>
            <th>Xã/phường</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" :class="{ 'row-me': u.id === authStore.user?.id, 'row-locked': !u.isActive }">
            <td>
              <div class="u-name">{{ u.name }}</div>
              <div class="u-phone">{{ u.phone }}</div>
            </td>
            <td>
              <select
                :value="u.role"
                :disabled="u.id === authStore.user?.id || dangXuLyId === u.id"
                @change="xuLyDoiVaiTro(u, ($event.target as HTMLSelectElement).value as UserRole)"
              >
                <option value="victim">Người dân</option>
                <option value="rescuer">Cứu hộ</option>
                <option value="commander">Chỉ huy</option>
              </select>
            </td>
            <td>{{ u.wardCode || '—' }}</td>
            <td>
              <span class="status-badge" :class="u.isActive ? 'status-active' : 'status-locked'">
                {{ u.isActive ? 'Hoạt động' : 'Đã khoá' }}
              </span>
            </td>
            <td class="u-time">{{ formatTime(u.createdAt) }}</td>
            <td>
              <button
                v-if="u.id !== authStore.user?.id"
                class="btn btn-ghost btn-sm"
                :disabled="dangXuLyId === u.id"
                @click="xuLyKhoaMoKhoa(u)"
              >
                {{ u.isActive ? 'Khoá' : 'Mở khoá' }}
              </button>
              <span v-else class="u-self-note">Tài khoản của bạn</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!loading && users.length > 0" class="users-count">{{ tongSoHienThi }} tài khoản</p>
    </main>

    <!-- Modal tạo tài khoản -->
    <div v-if="modalOpen" class="modal-overlay open" @click.self="dongModal">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Tạo tài khoản mới</h3>
          <button class="modal-close" @click="dongModal">✕</button>
        </div>

        <label class="form-label">Họ tên
          <input v-model="formName" type="text" placeholder="Nguyễn Văn A" />
        </label>
        <label class="form-label">Số điện thoại
          <input v-model="formPhone" type="tel" inputmode="numeric" placeholder="09xxxxxxxx" />
        </label>
        <label class="form-label">Mật khẩu
          <input v-model="formPassword" type="password" placeholder="Tối thiểu 8 ký tự" />
        </label>
        <label class="form-label">Vai trò
          <select v-model="formRole">
            <option value="victim">Người dân</option>
            <option value="rescuer">Cứu hộ</option>
            <option value="commander">Chỉ huy</option>
          </select>
        </label>
        <label class="form-label">Mã xã/phường (tuỳ chọn)
          <input v-model="formWardCode" type="text" placeholder="VD: 24823" />
        </label>

        <button class="btn btn-primary users-submit" :disabled="dangTao" @click="xuLyTaoTaiKhoan">
          {{ dangTao ? 'Đang tạo...' : 'Tạo tài khoản' }}
        </button>
      </div>
    </div>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.users-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fog);
}
.users-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.users-top-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.users-top-left h1 {
  font-size: 18px;
}
.users-back {
  font-size: 13px;
  color: var(--pine-deep);
  text-decoration: none;
  opacity: 0.75;
}
.users-back:hover {
  opacity: 1;
  text-decoration: underline;
}
.users-top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.users-user {
  font-size: 13px;
  color: var(--pine-deep);
  font-weight: 500;
}

.users-body {
  flex: 1;
  padding: 24px;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
}
.users-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
  flex-wrap: wrap;
}
.users-filter {
  display: flex;
  gap: 4px;
  background: var(--fog-dim);
  border-radius: 10px;
  padding: 4px;
}
.users-filter button {
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(42, 42, 36, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}
.users-filter button.active {
  background: #fff;
  color: var(--pine-deep);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.panel-empty {
  padding: 40px 20px;
  text-align: center;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.users-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(42, 42, 36, 0.55);
  border-bottom: 1px solid var(--line);
  background: var(--fog-dim);
}
.users-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  vertical-align: middle;
}
.users-table tr:last-child td {
  border-bottom: none;
}
.row-me {
  background: rgba(20, 39, 32, 0.03);
}
.row-locked {
  opacity: 0.6;
}
.u-name {
  font-weight: 500;
}
.u-phone {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}
.u-time {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}
.u-self-note {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.45);
  font-style: italic;
}

.status-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.status-active {
  background: #dcfce7;
  color: #16a34a;
}
.status-locked {
  background: #fee2e2;
  color: #dc2626;
}

.users-table select {
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.users-table select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.users-count {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--ink);
  margin-bottom: 14px;
}
.form-label input,
.form-label select {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 9px;
  font-size: 14px;
}
.users-submit {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}
.users-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

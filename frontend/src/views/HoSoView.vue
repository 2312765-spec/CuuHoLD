<script setup lang="ts">
// F-UI-01 — hồ sơ cá nhân + đổi mật khẩu, mọi role (CLAUDE.md Mục 15.16). API theo đặc tả
// F-UI-01-dac-ta-API-cho-B.md: chỉ sửa được TÊN. SĐT (tên đăng nhập, nhận SMS) và xã/phường
// (với rescuer quyết định được xem SOS xã nào) chỉ hiển thị để xem.
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { capNhatHoSo, doiMatKhau } from '@/services/auth.service'
import { USER_ROLE_LABEL } from '@/constants/sosLabels'

const authStore = useAuthStore()
const toastStore = useToastStore()

// Nút quay lại về đúng màn làm việc của từng role.
const trangChinh = computed(() =>
  authStore.role === 'rescuer' ? '/rescuer' : authStore.role === 'commander' ? '/dashboard' : '/map'
)

// ---------- Tên ----------
const ten = ref(authStore.user?.name ?? '')
const dangLuuTen = ref(false)
const loiTen = ref('')

async function luuTen() {
  const tenMoi = ten.value.trim()
  loiTen.value = ''
  if (tenMoi.length < 2 || tenMoi.length > 100) {
    loiTen.value = 'Tên phải từ 2 đến 100 ký tự.'
    return
  }
  if (tenMoi === authStore.user?.name) return
  dangLuuTen.value = true
  try {
    authStore.capNhatUser(await capNhatHoSo(tenMoi))
    ten.value = tenMoi
    toastStore.showToast('Đã cập nhật thông tin.')
  } catch {
    // http.ts đã hiện toast lý do lỗi.
  } finally {
    dangLuuTen.value = false
  }
}

// ---------- Mật khẩu ----------
const mkHienTai = ref('')
const mkMoi = ref('')
const mkNhapLai = ref('')
const hienMatKhau = ref(false)
const dangDoiMk = ref(false)
const loiMk = ref('')

async function doiMk() {
  loiMk.value = ''
  if (!mkHienTai.value) {
    loiMk.value = 'Nhập mật khẩu hiện tại.'
    return
  }
  // Cùng quy tắc với đăng ký (RegisterDto: tối thiểu 8 ký tự) — backend vẫn kiểm lại.
  if (mkMoi.value.length < 8) {
    loiMk.value = 'Mật khẩu mới phải có ít nhất 8 ký tự.'
    return
  }
  if (mkMoi.value !== mkNhapLai.value) {
    loiMk.value = 'Mật khẩu nhập lại không khớp.'
    return
  }
  if (mkMoi.value === mkHienTai.value) {
    loiMk.value = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    return
  }
  dangDoiMk.value = true
  try {
    await doiMatKhau(mkHienTai.value, mkMoi.value)
    mkHienTai.value = ''
    mkMoi.value = ''
    mkNhapLai.value = ''
    toastStore.showToast('Đã đổi mật khẩu.')
  } catch {
    // Sai mật khẩu hiện tại → backend trả 400, http.ts hiện toast. Giữ nguyên các ô đã gõ
    // để người dùng chỉ cần sửa ô sai.
  } finally {
    dangDoiMk.value = false
  }
}
</script>

<template>
  <div class="ho-so-page">
    <header class="ho-so-top">
      <RouterLink :to="trangChinh" class="ho-so-back" aria-label="Quay lại">←</RouterLink>
      <h1>Hồ sơ của tôi</h1>
    </header>

    <main v-if="authStore.user" class="ho-so-body">
      <section class="ho-so-the" aria-labelledby="tt-title">
        <h2 id="tt-title">Thông tin tài khoản</h2>
        <dl class="ho-so-dl">
          <div>
            <dt>Số điện thoại</dt>
            <dd>{{ authStore.user.phone }}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{{ USER_ROLE_LABEL[authStore.user.role] }}</dd>
          </div>
          <div v-if="authStore.user.wardCode">
            <dt>Mã xã/phường</dt>
            <dd>{{ authStore.user.wardCode }}</dd>
          </div>
        </dl>
        <p class="ho-so-ghi-chu">
          Số điện thoại và xã/phường không tự đổi được. Cần đổi, liên hệ trung tâm điều phối.
        </p>

        <form class="ho-so-form" data-test="form-ten" novalidate @submit.prevent="luuTen">
          <label for="ho-so-ten">Họ và tên</label>
          <input
            id="ho-so-ten"
            v-model="ten"
            name="name"
            type="text"
            autocomplete="name"
            maxlength="100"
            :aria-invalid="!!loiTen"
            aria-describedby="ho-so-ten-loi"
          />
          <p v-if="loiTen" id="ho-so-ten-loi" class="ho-so-loi" role="alert">{{ loiTen }}</p>
          <button type="submit" class="btn btn-primary" :disabled="dangLuuTen">
            {{ dangLuuTen ? 'Đang lưu...' : 'Lưu tên' }}
          </button>
        </form>
      </section>

      <section class="ho-so-the" aria-labelledby="mk-title">
        <h2 id="mk-title">Đổi mật khẩu</h2>
        <form class="ho-so-form" data-test="form-mat-khau" novalidate @submit.prevent="doiMk">
          <label for="mk-hien-tai">Mật khẩu hiện tại</label>
          <input
            id="mk-hien-tai"
            v-model="mkHienTai"
            name="current-password"
            :type="hienMatKhau ? 'text' : 'password'"
            autocomplete="current-password"
          />
          <label for="mk-moi">Mật khẩu mới (ít nhất 8 ký tự)</label>
          <input
            id="mk-moi"
            v-model="mkMoi"
            name="new-password"
            :type="hienMatKhau ? 'text' : 'password'"
            autocomplete="new-password"
          />
          <label for="mk-nhap-lai">Nhập lại mật khẩu mới</label>
          <input
            id="mk-nhap-lai"
            v-model="mkNhapLai"
            name="confirm-password"
            :type="hienMatKhau ? 'text' : 'password'"
            autocomplete="new-password"
          />
          <label class="ho-so-hien-mk">
            <input v-model="hienMatKhau" type="checkbox" />
            Hiện mật khẩu
          </label>
          <p v-if="loiMk" class="ho-so-loi" role="alert">{{ loiMk }}</p>
          <button type="submit" class="btn btn-primary" :disabled="dangDoiMk">
            {{ dangDoiMk ? 'Đang đổi...' : 'Đổi mật khẩu' }}
          </button>
        </form>
      </section>
    </main>
  </div>
</template>

<style scoped>
.ho-so-page {
  min-height: 100vh;
  background: var(--fog);
  color: #2a2a24;
  color-scheme: light;
}
/* style.css có rule toàn cục `header { position: fixed }` (xem RescuerView.vue) — sticky để
   header vẫn chiếm chỗ, không che nội dung. */
.ho-so-top {
  position: sticky;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.96);
}
.ho-so-top h1 {
  font-size: 18px;
  margin: 0;
}
.ho-so-back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--pine-deep);
  font-size: 20px;
  text-decoration: none;
}
.ho-so-body {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 20px 40px;
  display: grid;
  gap: 16px;
}
.ho-so-the {
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
}
.ho-so-the h2 {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--pine-deep);
}
.ho-so-dl {
  display: grid;
  gap: 8px;
  margin: 0;
}
.ho-so-dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}
.ho-so-dl dt {
  color: rgba(42, 42, 36, 0.65);
}
.ho-so-dl dd {
  margin: 0;
  font-weight: 600;
}
.ho-so-ghi-chu {
  margin: 10px 0 16px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}
.ho-so-form {
  display: grid;
  gap: 6px;
}
.ho-so-form label {
  font-size: 13px;
  font-weight: 500;
  margin-top: 6px;
}
.ho-so-form input[type='text'],
.ho-so-form input[type='password'] {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #ffffff;
  color: #2a2a24;
  /* ≥16px: Safari iOS không tự zoom khi chạm vào ô nhập */
  font-size: 16px;
}
.ho-so-form input[aria-invalid='true'] {
  border-color: #b91c1c;
}
.ho-so-hien-mk {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 400 !important;
}
.ho-so-loi {
  margin: 4px 0 0;
  font-size: 13px;
  color: #b91c1c;
}
.ho-so-form .btn {
  margin-top: 10px;
  justify-self: start;
}
.ho-so-form input:focus-visible,
.ho-so-form .btn:focus-visible,
.ho-so-back:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: 2px;
}
</style>

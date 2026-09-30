<script setup lang="ts">
// F-UI-01 — hồ sơ cá nhân + đổi mật khẩu, mọi role (CLAUDE.md Mục 15.16). API theo đặc tả
// F-UI-01-dac-ta-API-cho-B.md: chỉ sửa được TÊN. SĐT (tên đăng nhập, nhận SMS) và xã/phường
// (với rescuer quyết định được xem SOS xã nào) chỉ hiển thị để xem.
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { capNhatHoSo, doiMatKhau } from '@/services/auth.service'
import { USER_ROLE_LABEL } from '@/constants/sosLabels'
import { useThongBaoDay } from '@/composables/useThongBaoDay'
import { useVetGpsStore } from '@/stores/vetGps.store'

const authStore = useAuthStore()
const toastStore = useToastStore()

// Nút quay lại về đúng màn làm việc của từng role.
const trangChinh = computed(() =>
  authStore.role === 'rescuer' ? '/rescuer' : authStore.role === 'commander' ? '/dashboard' : '/map'
)

// ---------- F-PWA-05: thông báo đẩy trên thiết bị này ----------
const thongBao = useThongBaoDay()
// Mỗi role nhận loại thông báo khác nhau (đặc tả gửi B, Mục 5) — nói rõ để người dùng biết
// bật lên thì được gì.
const moTaThongBao = computed(() => {
  if (authStore.role === 'rescuer') return 'Báo ngay khi đội của bạn được giao nhiệm vụ mới.'
  if (authStore.role === 'commander') return 'Báo ngay khi có SOS mới chưa có đội nhận.'
  return 'Báo khi yêu cầu SOS của bạn được phân công đội, đội tới nơi, hoặc hoàn tất.'
})
onMounted(() => {
  void thongBao.kiemTra()
})

// ---------- SRS F-PWA-04: ghi vết GPS ----------
const vetGps = useVetGpsStore()
const dangBatVet = ref(false)
async function batTatVet() {
  if (vetGps.dangBat) {
    vetGps.tat()
    return
  }
  dangBatVet.value = true
  try {
    await vetGps.bat()
  } finally {
    dangBatVet.value = false
  }
}
function gioNgan(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'
}

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

      <section class="ho-so-the" aria-labelledby="tb-title" data-test="thong-bao">
        <h2 id="tb-title">Thông báo đẩy</h2>
        <p class="ho-so-mo-ta">{{ moTaThongBao }} Chỉ áp dụng cho thiết bị đang dùng.</p>

        <p v-if="thongBao.trangThai.value === 'dang-kiem-tra'" class="ho-so-ghi-chu">Đang kiểm tra...</p>
        <p v-else-if="thongBao.trangThai.value === 'khong-ho-tro'" class="ho-so-ghi-chu">
          Trình duyệt này không hỗ trợ thông báo đẩy (hoặc trang không mở bằng https://).
        </p>
        <p v-else-if="thongBao.trangThai.value === 'can-cai-app'" class="ho-so-ghi-chu">
          Trên iPhone/iPad, hãy thêm ứng dụng ra Màn hình chính (nút Chia sẻ → "Thêm vào MH chính"),
          mở ứng dụng từ đó rồi bật thông báo tại đây.
        </p>
        <p v-else-if="thongBao.trangThai.value === 'bi-chan'" class="ho-so-ghi-chu">
          Bạn đã chặn thông báo cho trang này. Mở cài đặt trình duyệt → Quyền trang web → Thông báo
          để cho phép lại.
        </p>
        <template v-else>
          <p class="ho-so-trang-thai-tb" aria-live="polite">
            Trạng thái: <strong>{{ thongBao.trangThai.value === 'bat' ? 'Đang bật' : 'Đang tắt' }}</strong>
          </p>
          <p v-if="thongBao.loi.value" class="ho-so-loi" role="alert">{{ thongBao.loi.value }}</p>
          <button
            v-if="thongBao.trangThai.value === 'tat'"
            type="button"
            class="btn btn-primary"
            data-test="bat-thong-bao"
            :disabled="thongBao.dangXuLy.value"
            @click="thongBao.bat()"
          >
            {{ thongBao.dangXuLy.value ? 'Đang bật...' : 'Bật thông báo' }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-ghost"
            data-test="tat-thong-bao"
            :disabled="thongBao.dangXuLy.value"
            @click="thongBao.tat()"
          >
            {{ thongBao.dangXuLy.value ? 'Đang tắt...' : 'Tắt thông báo' }}
          </button>
        </template>
      </section>

      <section class="ho-so-the" aria-labelledby="vet-title" data-test="vet-gps">
        <h2 id="vet-title">Ghi vết hành trình</h2>
        <p class="ho-so-mo-ta">
          Tự lưu vị trí của bạn mỗi 2 phút ngay trên máy này, kể cả khi mất mạng. Hữu ích khi đi
          rừng, leo núi: nếu gặp nạn và gửi SOS, 5 vị trí gần nhất được gửi kèm để đội cứu hộ biết
          bạn đã đi qua đâu.
        </p>
        <p class="ho-so-ghi-chu">
          Vết chỉ nằm trên máy, không gửi đi đâu nếu bạn không gửi SOS. Tự xoá sau 48 giờ. Trình
          duyệt chỉ cho ghi khi ứng dụng đang mở — hãy để ứng dụng mở trong lúc di chuyển.
        </p>
        <p class="ho-so-trang-thai-tb" aria-live="polite">
          Trạng thái: <strong>{{ vetGps.dangBat ? 'Đang ghi' : 'Đang tắt' }}</strong>
          · {{ vetGps.soDiem }} điểm · điểm gần nhất: {{ gioNgan(vetGps.diemCuoiLuc) }}
        </p>
        <p v-if="vetGps.loi" class="ho-so-loi" role="alert">{{ vetGps.loi }}</p>
        <div class="ho-so-nut-hang">
          <button
            type="button"
            :class="vetGps.dangBat ? 'btn btn-ghost' : 'btn btn-primary'"
            data-test="bat-tat-vet"
            :disabled="dangBatVet"
            @click="batTatVet"
          >
            {{ dangBatVet ? 'Đang lấy vị trí...' : vetGps.dangBat ? 'Tắt ghi vết' : 'Bật ghi vết' }}
          </button>
          <button
            v-if="vetGps.soDiem > 0"
            type="button"
            class="btn btn-ghost"
            data-test="xoa-vet"
            @click="vetGps.xoaVet()"
          >
            Xoá vết đã lưu
          </button>
        </div>
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
.ho-so-mo-ta {
  margin: 0 0 10px;
  font-size: 14px;
}
.ho-so-trang-thai-tb {
  margin: 0 0 10px;
  font-size: 14px;
}
/* Trang luôn nền sáng — nút viền giữ chữ tối kể cả khi bật dark mode (xem 15.13 mục 5). */
.ho-so-the .btn-ghost {
  color: #2a2a24;
  border: 1.5px solid rgba(42, 42, 36, 0.4);
}
.ho-so-the > .btn:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: 2px;
}
.ho-so-nut-hang {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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

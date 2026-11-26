// Pinia store xác thực — lưu accessToken + thông tin user, cung cấp action login/logout.
//
// Lưu phiên qua sessionStorage (không phải localStorage): sống sót qua F5/reload trong
// cùng tab, tự xoá khi đóng tab/trình duyệt. Đây là fix tạm cho bug "reload là bị đăng
// xuất" — hướng đúng chuẩn lâu dài là refreshToken nằm trong cookie httpOnly (JS không
// đụng vào được, an toàn hơn trước XSS) + endpoint POST /api/auth/refresh thật, nhưng
// backend hiện chưa có (xem docs/api-contract.md, CLAUDE.md Mục 15.1) nên chưa làm được.
// Token khôi phục lại được xác thực ngay qua fetchMe() ở main.ts — token hết hạn/không
// hợp lệ sẽ bị interceptor 401 trong services/http.ts tự logout().
//
// Nhiều tab (CLAUDE.md Mục 15.30): sessionStorage mỗi tab một bản → tab mới từng thấy "đã đăng
// xuất". Giờ các tab trao phiên cho nhau qua utils/phienGiuaTab.ts: tab mới xin phiên lúc khởi
// động (main.ts), đăng nhập/đăng xuất ở một tab thì mọi tab đang mở làm theo.

import { defineStore } from 'pinia'
import { xoaHetTam } from '@/utils/nhoTam'
import { ref, computed, watch, toRaw } from 'vue'
import type { User } from '@/types/auth'
import { login as apiLogin, getMe as apiGetMe } from '@/services/auth.service'
import { huyThongBaoDayTrenMay } from '@/composables/useThongBaoDay'
import { xoaPhienDongBo } from '@/utils/offlineQueue'
import { moKenhPhien, type PhienChiaSe } from '@/utils/phienGiuaTab'

const STORAGE_KEY = 'rescue-gis-auth'

type StoredSession = PhienChiaSe

function docPhienDaLuu(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    // Riêng tư/quota bị chặn, hoặc dữ liệu lưu bị hỏng — coi như chưa đăng nhập.
    return null
  }
}

function luuPhien(session: StoredSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Không có sessionStorage (chế độ riêng tư nghiêm ngặt...) — chấp nhận mất khả năng
    // khôi phục phiên, không phải lỗi chặn đăng nhập.
  }
}

export const useAuthStore = defineStore('auth', () => {
  const saved = docPhienDaLuu()

  const accessToken = ref<string | null>(saved?.accessToken ?? null)
  const refreshToken = ref<string | null>(saved?.refreshToken ?? null)
  const user = ref<User | null>(saved?.user ?? null)

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value)
  const role = computed(() => user.value?.role ?? null)

  // Đồng bộ mọi thay đổi (login/setAuth/logout/fetchMe cập nhật user) xuống sessionStorage.
  watch([accessToken, refreshToken, user], () => {
    if (accessToken.value && refreshToken.value && user.value) {
      luuPhien({ accessToken: accessToken.value, refreshToken: refreshToken.value, user: user.value })
    } else {
      luuPhien(null)
    }
  })

  function phienHienTai(): StoredSession | null {
    if (!accessToken.value || !refreshToken.value || !user.value) return null
    // toRaw + sao chép: user.value là Proxy reactive, postMessage KHÔNG clone được Proxy
    // (DataCloneError) — tab kia sẽ không bao giờ nhận được phiên.
    return { accessToken: accessToken.value, refreshToken: refreshToken.value, user: { ...toRaw(user.value) } }
  }

  // Gán phiên nhận từ tab khác — KHÔNG phát lại (tránh các tab đẩy tin qua lại vô hạn).
  function nhanPhien(phien: StoredSession) {
    // Đổi sang tài khoản KHÁC mà không qua đăng xuất (tab khác đăng nhập người khác) → dữ liệu
    // trang nhớ tạm của người trước không được hiện cho người sau.
    if (user.value && user.value.id !== phien.user.id) xoaHetTam()
    accessToken.value = phien.accessToken
    refreshToken.value = phien.refreshToken
    user.value = phien.user
  }

  const kenh = moKenhPhien({
    layPhien: phienHienTai,
    khiNhanDangNhap: nhanPhien,
    khiNhanDangXuat: () => xoaPhienCucBo()
  })

  async function login(phone: string, password: string) {
    const res = await apiLogin(phone, password)
    setAuth(res)
    return res.user
  }

  // Gọi khi đã có token nhưng chưa có user (ví dụ khôi phục phiên) để lấy lại thông tin.
  async function fetchMe() {
    if (!accessToken.value) return null
    user.value = await apiGetMe()
    return user.value
  }

  function logout() {
    xoaPhienCucBo()
    kenh.phatDangXuat()
  }

  // Phần đăng xuất chạy ở MỌI tab (kể cả tab nhận tin từ tab khác).
  function xoaPhienCucBo() {
    // Dữ liệu trang nhớ tạm (utils/nhoTam.ts) có tên/SĐT người dùng — không để lại cho người
    // sau. Đặt ở đây (không phải logout()) để tab NHẬN tin đăng xuất từ tab khác cũng xoá.
    xoaHetTam()
    // F-PWA-05: huỷ đăng ký thông báo đẩy TRÊN MÁY (không gọi API — logout() cũng chạy lúc
    // token đã hết hạn/401). Không huỷ thì người đăng nhập kế tiếp trên cùng máy nhận thông
    // báo SOS của tài khoản này. Không await: đăng xuất phải xong ngay, bước này best-effort.
    void huyThongBaoDayTrenMay()
    // F-PWA-02: xoá token bản sao mà service worker dùng để gửi SOS nền — người dùng đã chủ
    // động đăng xuất thì token không được nằm lại trong IndexedDB. SOS còn chờ vẫn nằm trong
    // hàng đợi, tự gửi khi đúng người đó đăng nhập lại (như trước). Best-effort, không chặn.
    const idDangXuat = user.value?.id
    if (idDangXuat) xoaPhienDongBo(idDangXuat).catch(() => undefined)
    accessToken.value = null
    refreshToken.value = null
    user.value = null
  }

  // Gán phiên trực tiếp (dùng sau khi register trả token) — tránh $patch tên internal.
  function setAuth(data: { accessToken: string; refreshToken: string; user: User }) {
    nhanPhien(data)
    const phien = phienHienTai()
    if (phien) kenh.phatDangNhap(phien)
  }

  // F-UI-01: backend trả user mới sau PATCH /users/me — thay tại chỗ, token giữ nguyên.
  // watch ở trên tự ghi xuống sessionStorage nên F5 vẫn thấy tên mới.
  function capNhatUser(moi: User) {
    user.value = moi
    const phien = phienHienTai()
    if (phien) kenh.phatDangNhap(phien)
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn,
    role,
    login,
    fetchMe,
    logout,
    setAuth,
    nhanPhien,
    capNhatUser
  }
})
// Composable quản lý GIAO DIỆN: chế độ sáng/tối (F-UI-05 trong SRS Mục 3.6).
// State để Ở CẤP MODULE (ngoài hàm) — giống useInstallPrompt.ts — nên mọi nơi gọi
// useTheme() đều DÙNG CHUNG một trạng thái: đổi ở AppHeader thì mọi component khác thấy
// ngay, không mỗi chỗ giữ một bản riêng rồi lệch nhau.
//
// Áp dụng bằng thuộc tính data-theme trên <html> (documentElement); CSS đọc qua selector
// :root[data-theme="dark"] (xem phần thêm ở cuối assets/style.css). Lựa chọn lưu localStorage
// để giữ qua các phiên. LẦN ĐẦU (chưa từng chọn) bám theo cài đặt hệ điều hành
// prefers-color-scheme — máy đang để nền tối thì mở app cũng tối, đỡ chói mắt lúc khẩn cấp
// ban đêm.

import { ref } from 'vue'

type Theme = 'light' | 'dark'

const KEY_THEME = 'rescue-theme'

function docLuaChonBanDau(): Theme {
  const luu = localStorage.getItem(KEY_THEME)
  if (luu === 'light' || luu === 'dark') return luu
  // matchMedia có thể thiếu trong môi trường test (jsdom) — optional chaining cho an toàn.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<Theme>(docLuaChonBanDau())

function apDung(): void {
  document.documentElement.setAttribute('data-theme', theme.value)
}

// Áp dụng NGAY khi module được import lần đầu (main.ts import sớm, trước app.mount) — tránh
// nháy sáng→tối (FOUC) do phải chờ component mount mới gắn thuộc tính.
apDung()

export function useTheme() {
  function datTheme(t: Theme): void {
    theme.value = t
    localStorage.setItem(KEY_THEME, t)
    apDung()
  }
  function chuyenTheme(): void {
    datTheme(theme.value === 'dark' ? 'light' : 'dark')
  }
  return { theme, datTheme, chuyenTheme }
}
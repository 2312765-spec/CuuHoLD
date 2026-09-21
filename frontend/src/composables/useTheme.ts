// Composable quản lý GIAO DIỆN & KHẢ NĂNG TIẾP CẬN:
//   - F-UI-05: chế độ sáng/tối (data-theme)
//   - F-UI-06: cỡ chữ lớn (data-font) và tương phản cao (data-contrast)
// State để Ở CẤP MODULE (ngoài hàm) — giống useInstallPrompt.ts — nên mọi nơi gọi
// useTheme() đều DÙNG CHUNG một trạng thái, đổi ở đâu thì cả app thấy ngay.
//
// Tất cả áp dụng bằng thuộc tính data-* trên <html>; CSS đọc qua các selector
// :root[data-theme="dark"] / [data-font="large"] / [data-contrast="high"] (xem style.css).
// Lựa chọn lưu localStorage để giữ qua các phiên. Theme LẦN ĐẦU bám theo cài đặt hệ điều
// hành (prefers-color-scheme).

import { ref } from 'vue'

type Theme = 'light' | 'dark'
type FontScale = 'normal' | 'large'
type Contrast = 'normal' | 'high'

const KEY_THEME = 'rescue-theme'
const KEY_FONT = 'rescue-font-scale'
const KEY_CONTRAST = 'rescue-contrast'

function docThemeBanDau(): Theme {
  const luu = localStorage.getItem(KEY_THEME)
  if (luu === 'light' || luu === 'dark') return luu
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<Theme>(docThemeBanDau())
const fontScale = ref<FontScale>(localStorage.getItem(KEY_FONT) === 'large' ? 'large' : 'normal')
const contrast = ref<Contrast>(localStorage.getItem(KEY_CONTRAST) === 'high' ? 'high' : 'normal')

function apDung(): void {
  const el = document.documentElement
  el.setAttribute('data-theme', theme.value)
  el.setAttribute('data-font', fontScale.value)
  el.setAttribute('data-contrast', contrast.value)
}

// Áp dụng NGAY khi module được import lần đầu (main.ts import sớm) — tránh nháy giao diện.
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
  function chuyenCoChu(): void {
    fontScale.value = fontScale.value === 'large' ? 'normal' : 'large'
    localStorage.setItem(KEY_FONT, fontScale.value)
    apDung()
  }
  function chuyenTuongPhan(): void {
    contrast.value = contrast.value === 'high' ? 'normal' : 'high'
    localStorage.setItem(KEY_CONTRAST, contrast.value)
    apDung()
  }
  return { theme, fontScale, contrast, datTheme, chuyenTheme, chuyenCoChu, chuyenTuongPhan }
}
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// File cấu hình RIÊNG cho vitest — tách khỏi vite.config.ts vì vite.config.ts còn có
// VitePWA() (khởi tạo Service Worker/manifest, không liên quan gì và không cần thiết khi
// chạy unit test) và các khối server/preview proxy vốn vô nghĩa trong môi trường test.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    // globals:false (mặc định) — import describe/it/expect/vi tường minh từ 'vitest' thay
    // vì bơm vào global, khỏi phải sửa "types" trong tsconfig.json cho cả dự án chỉ vì test.
    environment: 'jsdom'
  }
})

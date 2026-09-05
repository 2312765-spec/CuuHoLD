import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // 'autoUpdate': tự tải bản Service Worker mới khi có, không bắt người dùng
      // xoá cache tay — phù hợp với web tra cứu, khác 'prompt' (hỏi trước khi cập nhật).
      registerType: 'autoUpdate',

      // BẮT BUỘC để test được ngay lúc `npm run dev` — mặc định vite-plugin-pwa
      // TẮT Service Worker khi ở chế độ dev (tránh cache đè lên code đang sửa dở).
      // Bật cờ này chỉ để tiện kiểm tra khi đang học/làm đồ án; cân nhắc tắt lại
      // (xoá cả khối devOptions) khi đã ổn định, để đúng hành vi mặc định an toàn hơn.
      devOptions: { enabled: true },

      manifest: {
        name: 'Bản Đồ Cứu Trợ Lâm Đồng',
        short_name: 'Cứu Trợ LĐ',
        description:
          'Bản đồ ranh giới hành chính, điểm cứu trợ và cảnh báo sự cố cho tỉnh Lâm Đồng.',
        lang: 'vi',
        start_url: '/',
        display: 'standalone', // mở như app thật, ẩn thanh địa chỉ trình duyệt
        background_color: '#f5f1e6', // --fog, màu hiện lúc app đang tải (splash screen)
        theme_color: '#142720', // --pine-deep, màu thanh trạng thái hệ thống
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },

      workbox: {
        // Chiến lược cache riêng cho từng loại dữ liệu — xem giải thích trong hội thoại:
        // tile bản đồ & dữ liệu ranh giới không nên xử lý giống nhau.
        runtimeCaching: [
          {
            // Tile OpenStreetMap: ưu tiên MẠNG trước (bản đồ luôn cần mới nhất khi có mạng),
            // cache chỉ để dự phòng lúc mất mạng — và giới hạn số lượng, tự hết hạn sau
            // 30 ngày, tránh cache phình to vô hạn vì có rất nhiều tile khác nhau.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Dữ liệu ranh giới hành chính: tĩnh, hiếm khi đổi — ưu tiên CACHE trước,
            // vẫn cập nhật ngầm phía sau (stale-while-revalidate) để không kẹt bản quá cũ.
            urlPattern: /\/lamdong_tinh\.geojson$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'boundary-data' }
          }
        ]
      }
    })
  ],
  // Cho phép truy cập qua tunnel ngrok (Vite mặc định chỉ cho localhost).
  // '.ngrok-free.dev' và '.ngrok-free.app' khớp mọi subdomain ngrok, không cần
  // sửa lại mỗi lần đổi link. Chỉ ảnh hưởng dev server, không ảnh hưởng bản build.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  // Proxy + allowedHosts cho DEV server (npm run dev, cổng 5173).
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true }
    }
  },

  // Proxy + allowedHosts cho PREVIEW server (npm run preview, cổng 4173).
  // BẮT BUỘC khai báo riêng — khối server: ở trên KHÔNG áp dụng cho preview.
  preview: {
    host: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true }
    }
  }
})
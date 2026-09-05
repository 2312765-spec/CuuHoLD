# Bản Đồ Cứu Trợ Lâm Đồng — bản Vue 3 + TypeScript

Giao diện y hệt bản HTML/CSS/JS thuần trước đó — chỉ khác cách tổ chức code.

## Cách chạy

Cần cài **Node.js** trước (khác với bản cũ chỉ cần Live Server, bản này **bắt buộc phải cài đặt** vì có bước biên dịch TypeScript → JavaScript).

```bash
npm install     # cài Vue, TypeScript, Vite, Leaflet... (chỉ cần chạy 1 lần)
npm run dev     # chạy server phát triển, có hot-reload khi sửa code
```

Mở địa chỉ hiện trên terminal (thường là `http://localhost:5173`).

Khi cần build ra file tĩnh để deploy thật (không phải chạy `npm run dev` mãi):

```bash
npm run build     # kiểm tra kiểu TypeScript + đóng gói vào thư mục dist/
npm run preview   # xem thử bản build đó
```

## Cấu trúc thư mục

```
src/
├── main.ts                    # điểm khởi động app
├── App.vue                    # khung chứa router
├── config.ts                  # cấu hình API (bản TS của config.js cũ)
├── types/index.ts             # định nghĩa kiểu dữ liệu dùng chung
├── directives/reveal.ts       # v-reveal — thay IntersectionObserver viết tay cũ
├── composables/
│   └── useLeafletMap.ts       # toàn bộ logic Leaflet (bản TS của map.js cũ)
├── router/index.ts            # 2 route: / (trang chủ) và /map (bản đồ)
├── assets/
│   ├── style.css              # y hệt style.css cũ, không đổi 1 dòng
│   └── map-style.css          # y hệt map.css cũ, chỉ đổi selector body → .map-page
├── views/
│   ├── HomeView.vue           # trang chủ — ghép các component bên dưới
│   └── MapView.vue            # trang bản đồ — ghép component map/
└── components/
    ├── AppHeader.vue
    ├── AppFooter.vue
    ├── FeatureCards.vue       # 3 thẻ "Ranh giới / Điểm cứu trợ / Báo cáo"
    ├── ProcessSteps.vue       # 3 bước quy trình
    ├── HighlightFeatures.vue  # 6 thẻ tính năng nổi bật
    └── map/
        ├── MapTopBar.vue
        ├── MapStats.vue
        └── MapLegend.vue

public/
└── lamdong_tinh.geojson       # dữ liệu ranh giới thật (Vite tự phục vụ file này ở gốc /)
```

## Vì sao chuyển sang Vue 3 + TypeScript không đổi giao diện

- Toàn bộ CSS (`style.css`, `map.css`) được copy **nguyên vẹn**, không sửa selector hay giá trị nào (trừ 1 chỗ `body.map-page` → `.map-page`, bắt buộc vì lý do kỹ thuật SPA, xem giải thích trong hội thoại).
- Nội dung HTML (chữ, class, thứ tự thẻ) được giữ y hệt — chỉ bọc lại trong cú pháp `<template>` của từng component.
- Các thẻ tuỳ chỉnh (`v-for`, `v-if`, `RouterLink`) chỉ thay thế cách JavaScript cũ *sinh ra cùng một HTML đó* — trình duyệt render ra kết quả giống nhau.

## Những nơi cần nối API thật sau này

Tìm từ khoá `Chưa có backend thật` trong `src/composables/useLeafletMap.ts` và `src/views/MapView.vue` — đó là các điểm đã chừa sẵn để gọi `CONFIG.apiBaseUrl` khi có PostGIS + API thật.

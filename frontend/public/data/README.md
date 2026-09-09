# Dữ liệu ranh giới hành chính — nguồn & ghi công

## `lamdong-wards.geojson`

Ranh giới **123 xã/phường/đặc khu** của tỉnh Lâm Đồng sau sáp nhập 2025, dùng cho lớp
"Ranh giới" trên bản đồ (`src/composables/useLeafletMap.ts`).

| | |
|---|---|
| **Nguồn gốc** | **gis.vn** (trường `name` của file gốc ghi `"gis.vn"`) |
| **Lấy qua** | [github.com/2314283-MVQuang/website-cuu-tro](https://github.com/2314283-MVQuang/website-cuu-tro) — file `public/data/lam_dong_data.json` |
| **Hệ toạ độ** | WGS84 (EPSG:4326), thứ tự `[kinh độ, vĩ độ]` chuẩn GeoJSON |
| **Kiểu hình học** | MultiPolygon, 123 feature |
| **Thuộc tính** | `ma_xa`, `ten_xa`, `loai`, `sap_nhap`, `dtich_km2`, `dan_so` |

**KHÔNG sửa file này bằng tay.** Nó được sinh ra bởi:

```bash
npm run build:wards                    # tải nguồn từ GitHub
npm run build:wards -- <file.json>     # dùng file có sẵn, không cần mạng
```

Script (`scripts/build-wards-geojson.mjs`) làm tròn toạ độ về 4 chữ số thập phân (~11 m),
đưa file từ 19.5 MB xuống ~9.2 MB (~1.2 MB sau nén gzip) mà không nhìn ra khác biệt ở mức
hiển thị toàn tỉnh.

Cùng nguồn này đã được dùng để sinh seed cho bảng `wards` trong PostGIS — xem
`gis/02-seed-wards.sql`. Nên bản đồ và cơ sở dữ liệu luôn khớp nhau.

### ⚠️ Thiếu 1 đơn vị: Xã Đam Rông 2

Theo **Nghị quyết 1671/NQ-UBTVQH15** (hiệu lực 16/6/2025), Lâm Đồng mới có **124** đơn vị
hành chính cấp xã: 103 xã + 20 phường + 1 đặc khu. Nguồn dữ liệu này chỉ có **123** —
khuyết **Xã Đam Rông 2** (dataset có Đam Rông 1 `24886`, Đam Rông 3 `24875`, Đam Rông 4
`24853`).

Bảng `wards` trong DB sinh từ đúng file này nên cùng thiếu — bản đồ và DB vẫn nhất quán.

**Hệ quả cần biết:** yêu cầu SOS gửi từ trong địa phận Đam Rông 2 sẽ không khớp ward nào
qua `ST_Contains` → `ward_code` NULL → không vào được room `ward:{ward_code}` tương ứng,
nên rescuer/commander của khu vực đó sẽ không nhận được thông báo thời gian thực.

Khi kiếm được ranh giới Đam Rông 2: bổ sung vào file nguồn, chạy lại `npm run build:wards`,
và sinh lại `gis/02-seed-wards.sql` cho DB.

## `../lamdong_tinh.geojson`

Ranh giới cấp **tỉnh** (1 feature). Chỉ dùng làm phương án dự phòng khi không tải được
file xã/phường, để bản đồ không trống trơn.

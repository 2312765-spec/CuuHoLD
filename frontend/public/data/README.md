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

### ✅ Đã vá đơn vị từng thiếu: Xã Đam Rông 2 (2026-09-17)

Theo **Nghị quyết 1671/NQ-UBTVQH15** (hiệu lực 16/6/2025), Lâm Đồng mới có **124** đơn vị
hành chính cấp xã: 103 xã + 20 phường + 1 đặc khu. Nguồn chính (gis.vn, qua GitHub repo ở
trên) chỉ có **123** — khuyết **Xã Đam Rông 2** (dataset có Đam Rông 1 `24886`, Đam Rông 3
`24875`, Đam Rông 4 `24853`).

`scripts/build-wards-geojson.mjs` giờ tự động vá thêm đúng feature này từ nguồn thứ 2
(`github.com/thanglequoc/vietnamese-provinces-database`, mã xã `24877`) mỗi lần chạy
`npm run build:wards` — không cần sửa tay. Diện tích trong file đó (365.58 km²) khớp độc
lập với số liệu báo chí, đủ tin cậy dù chưa phải bản đo đạc lại chính thức của Chính phủ.

⚠️ Vì 2 nguồn số hoá độc lập, biên chung giữa Đam Rông 2 và láng giềng (Đam Rông 1/3,
Quảng Hòa) có thể lệch vài chục mét — không như các cặp xã còn lại (cùng nguồn gis.vn nên
khớp khít tuyệt đối). Không ảnh hưởng gán `ward_code` cho SOS thật.

Bảng `wards` trong DB **cần chạy riêng** `gis/09-add-dam-rong-2.sql` (dùng polygon đầy đủ
độ chính xác gốc, không qua bước simplify ở trên) — xem file đó để biết đầy đủ nguồn/lý do.

## `../lamdong_tinh.geojson`

Ranh giới cấp **tỉnh** (1 feature). Chỉ dùng làm phương án dự phòng khi không tải được
file xã/phường, để bản đồ không trống trơn.

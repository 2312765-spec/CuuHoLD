// Sinh public/data/lamdong-outline.geojson = đường viền CẢ TỈNH, gộp (dissolve) từ 124 xã/phường
// trong public/data/lamdong-wards.geojson. Dùng để giới hạn bản đồ trong tỉnh và che vùng ngoài
// tỉnh (utils/gioiHanTinh.ts). Chạy lại sau mỗi lần `npm run build:wards`:
//   npm run build:outline
// mapshaper dựng topology nên gộp các xã kề nhau không để lại khe hở giữa chúng; giản lược thêm
// 150 m cho nhẹ — chỉ để che vùng ngoài tỉnh, không dùng tính toán nghiệp vụ.
import mapshaper from 'mapshaper'
import { statSync } from 'node:fs'

const VAO = 'public/data/lamdong-wards.geojson'
const RA = 'public/data/lamdong-outline.geojson'

await mapshaper.runCommands(
  `-i ${VAO} -dissolve -filter-slivers min-area=1km2 -simplify interval=150 keep-shapes ` +
    `-o ${RA} format=geojson precision=0.00001 force`
)
console.log(`Đã ghi ${RA} (${Math.round(statSync(RA).size / 1024)} KB)`)

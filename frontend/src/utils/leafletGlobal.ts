// leaflet.markercluster và leaflet.heat là plugin kiểu cũ: lúc được import, chúng gắn thẳng
// vào biến toàn cục `L` (VD: L.MarkerClusterGroup = L.FeatureGroup.extend(...)).
//
// Hiện tại Leaflet 1.9 chỉ có bản UMD (package.json không có "module"/"exports") và bản đó
// TỰ gán window.L — nên file này KHÔNG phải thứ đang giữ cho app chạy (đã kiểm chứng: bỏ nó
// đi, test RescueMap.spec.ts vẫn xanh). Giữ lại để thứ tự "L có trước plugin" được đảm bảo
// tường minh thay vì dựa ngầm vào chi tiết build của Leaflet: Leaflet 2 chỉ phát hành ESM và
// không gán window.L nữa — nâng cấp mà thiếu file này sẽ lỗi "L is not defined" lúc chạy.
// Phải được import TRƯỚC các plugin (xem utils/leafletPlugins.ts).
import L from 'leaflet'

;(window as unknown as { L: typeof L }).L = L

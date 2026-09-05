// Dựng L.DivIcon (icon marker HTML tuỳ biến) thay cho L.circleMarker chấm tròn phẳng cũ.
// Dùng divIcon với SVG nội tuyến — KHÔNG dùng L.Icon load ảnh từ file, nên tránh được
// hẳn lỗi kinh điển "marker icon vỡ đường dẫn" khi dùng Leaflet chung với Vite/webpack.

import L from 'leaflet'

export type MarkerKind = 'tiep-nhan' | 'khan-cap' | 'canh-bao'

const ICON_SVG: Record<MarkerKind, string> = {
  'tiep-nhan':
    '<svg viewBox="0 0 24 24" fill="none"><path d="M9 3L3 5.5V21L9 18.5L15 21L21 18.5V3L15 5.5L9 3Z" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  'khan-cap':
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L22 20H2L12 3Z" stroke="white" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10V14" stroke="white" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="17" r="0.9" fill="white"/></svg>',
  'canh-bao':
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L22 20H2L12 3Z" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>'
}

export function taoIconMarker(mau: string, kind: MarkerKind): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div class="marker-pin" style="background:${mau}">${ICON_SVG[kind]}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  })
}
// Vùng tile mà proxy chịu phục vụ: CHỈ các ô phủ tỉnh Lâm Đồng (+ nới 2 ô quanh biên).
// Lý do: route tile là public (thẻ <img> không gửi được Bearer token) — không giới hạn vùng thì
// ai cũng dùng backend làm proxy tải bản đồ toàn cầu, máy chủ tình nguyện OSM France thấy tải
// dồn từ 1 IP (Render) và có thể chặn → MỌI người dùng mất nền z11+ cùng lúc.
//
// ⚠️ PHẢI KHỚP frontend/src/constants/tileProvider.ts (LAMDONG_BBOX, tileX/tileY,
// TILE_PROXY_PADDING): frontend dùng cùng phép kiểm để chỉ xin proxy tile trong vùng, ô ngoài
// vùng gọi thẳng upstream. Lệch nhau thì ô sát biên sẽ bị backend từ chối 400 → frontend lùi về
// upstream (không mất nền, nhưng tốn thêm 1 request).

export const LAMDONG_BBOX = {
  minLng: 107.1,
  minLat: 9.8,
  maxLng: 109.2,
  maxLat: 12.9,
};
export const TILE_PROXY_PADDING = 2;
export const TILE_MAX_ZOOM = 18;

export function tileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function tileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
}

export function tileTrongVungPhucVu(z: number, x: number, y: number): boolean {
  if (!Number.isInteger(z) || z < 0 || z > TILE_MAX_ZOOM) return false;
  const p = TILE_PROXY_PADDING;
  const x0 = tileX(LAMDONG_BBOX.minLng, z) - p;
  const x1 = tileX(LAMDONG_BBOX.maxLng, z) + p;
  const y0 = tileY(LAMDONG_BBOX.maxLat, z) - p;
  const y1 = tileY(LAMDONG_BBOX.minLat, z) + p;
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

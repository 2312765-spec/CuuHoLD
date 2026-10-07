// Ảnh minh chứng do người dùng tải lên là dữ liệu KHÔNG đáng tin: không tin Content-Type/tên
// file client gửi (đổi được tuỳ ý), mà đọc chính các byte đầu (magic bytes) để biết đó có thật là
// jpeg/png/webp không. Chỉ ba định dạng ảnh raster phổ biến được chấp nhận — SVG/HTML bị loại
// vì có thể chứa script khi trình duyệt render.

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function detectImageMime(buf: Buffer): AllowedImageMime | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

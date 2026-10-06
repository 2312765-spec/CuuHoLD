// Chụp một khung hình từ camera thành JPEG nhỏ gọn để tải lên: ảnh chụp điện thoại thường 3–8MB,
// nén còn vài trăm KB để đi được qua 4G vùng núi và nằm gọn trong giới hạn 2MB của backend. Vẽ
// lại qua canvas cũng loại bỏ metadata EXIF (có thể chứa vị trí/thiết bị) khỏi file gửi đi.

const CANH_DAI_NHAT_PX = 1280
const CHAT_LUONG_JPEG = 0.75

export function tinhKichThuocMoi(
  w: number,
  h: number,
  max = CANH_DAI_NHAT_PX
): { w: number; h: number } {
  const canhDai = Math.max(w, h)
  if (canhDai <= max) return { w, h }
  const tyLe = max / canhDai
  return { w: Math.round(w * tyLe), h: Math.round(h * tyLe) }
}

// `nguon` là khung hình hiện tại của <video> (hoặc bất kỳ CanvasImageSource nào) cùng kích thước
// gốc của nó; trả JPEG đã thu nhỏ về tối đa CANH_DAI_NHAT_PX.
export function chupKhungHinhThanhJpeg(
  nguon: CanvasImageSource,
  rongGoc: number,
  caoGoc: number
): Promise<Blob> {
  const { w, h } = tinhKichThuocMoi(rongGoc, caoGoc)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh'))
  ctx.drawImage(nguon, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không nén được ảnh'))),
      'image/jpeg',
      CHAT_LUONG_JPEG
    )
  })
}

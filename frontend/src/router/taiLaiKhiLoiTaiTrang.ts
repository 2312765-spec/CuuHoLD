// Mỗi view được tải "lười" (component: () => import(...)) — bấm link thì router mới tải file JS
// của trang đó. Nếu lần tải ấy THẤT BẠI, vue-router huỷ chuyển trang IM LẶNG: bấm link không có
// phản ứng gì, chỉ Ctrl+click / F5 (tải lại toàn trang) mới vào được. Hai tình huống gặp thật:
//  - `npm run dev` sau khi cài package mới: Vite tối ưu lại thư viện, các file JS đã tham chiếu
//    trước đó trả 504 "Outdated Optimize Dep" cho tới khi tải lại trang.
//  - Bản deploy: người dùng đang mở tab cũ, nhóm deploy bản mới → tên file JS (có hash) đổi, file
//    cũ không còn → tab cũ bấm link là hỏng.
// Cách chữa chuẩn: tự tải lại TOÀN trang tới đúng địa chỉ (làm đúng việc Ctrl+click đang làm).

const MAU_LOI_TAI_TRANG =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i

// Chống vòng lặp: nếu vừa tải lại cho chính trang này mà vẫn lỗi (file hỏng thật, mất mạng hẳn)
// thì dừng — để lỗi hiện ra thay vì trang tự tải lại liên tục.
const KHOANG_CHONG_LAP_MS = 10_000
const KHOA = 'tai-lai-khi-loi-tai-trang'

export function laLoiTaiTrang(loi: unknown): boolean {
  return loi instanceof Error && MAU_LOI_TAI_TRANG.test(loi.message)
}

export function xuLyLoiTaiTrang(
  loi: unknown,
  duongDan: string,
  dieuHuong: (url: string) => void = (url) => window.location.assign(url),
  bayGio: () => number = Date.now
): void {
  if (!laLoiTaiTrang(loi)) return
  let lanTruoc: { duongDan: string; luc: number } | null = null
  try {
    lanTruoc = JSON.parse(sessionStorage.getItem(KHOA) ?? 'null')
  } catch {
    lanTruoc = null
  }
  if (lanTruoc && lanTruoc.duongDan === duongDan && bayGio() - lanTruoc.luc < KHOANG_CHONG_LAP_MS) {
    return
  }
  sessionStorage.setItem(KHOA, JSON.stringify({ duongDan, luc: bayGio() }))
  dieuHuong(duongDan)
}

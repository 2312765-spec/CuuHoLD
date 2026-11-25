// Chia sẻ phiên đăng nhập giữa các tab cùng trình duyệt (CLAUDE.md Mục 15.30).
//
// Vì sao cần: auth.store lưu phiên ở sessionStorage — mỗi tab một bản riêng, nên mở tab mới
// (Ctrl+T, bấm link) là thấy "đã đăng xuất". Chuyển sang localStorage thì token sống cả sau khi
// đóng trình duyệt (rủi ro XSS cao hơn); cookie httpOnly thì KHÔNG chạy được vì FE
// (*.vercel.app) và BE (*.onrender.com) là 2 site khác nhau → cookie bên thứ ba, Safari/iPhone
// chặn hẳn. Nên giữ sessionStorage, chỉ thêm kênh để các tab đang mở trao phiên cho nhau:
// - Tab mới chưa có phiên → hỏi; tab nào đang đăng nhập trả lời bằng phiên của nó.
// - Đăng nhập / đăng xuất ở 1 tab → mọi tab làm theo.
// Đóng HẾT tab thì không còn ai để hỏi → phiên mất, như trước.
//
// BroadcastChannel chỉ giao tin trong CÙNG origin, và không giao cho chính instance đã gửi.

import type { User } from '@/types/auth'

const TEN_KENH = 'rescue-gis-phien'

export interface PhienChiaSe {
  accessToken: string
  refreshToken: string
  user: User
}

type TinNhan =
  | { loai: 'xin' }
  | { loai: 'tra'; phien: PhienChiaSe }
  | { loai: 'dang-nhap'; phien: PhienChiaSe }
  | { loai: 'dang-xuat' }

function coKenh(): boolean {
  return typeof BroadcastChannel !== 'undefined'
}

function laPhien(x: unknown): x is PhienChiaSe {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  const u = p.user as Record<string, unknown> | null | undefined
  return (
    typeof p.accessToken === 'string' &&
    typeof p.refreshToken === 'string' &&
    !!u &&
    typeof u === 'object' &&
    typeof u.id === 'string' &&
    typeof u.role === 'string'
  )
}

function docTin(data: unknown): TinNhan | null {
  if (!data || typeof data !== 'object') return null
  const t = data as { loai?: unknown; phien?: unknown }
  if (t.loai === 'xin' || t.loai === 'dang-xuat') return { loai: t.loai }
  if ((t.loai === 'tra' || t.loai === 'dang-nhap') && laPhien(t.phien)) {
    return { loai: t.loai, phien: t.phien }
  }
  return null
}

// Tab mới gọi lúc khởi động. Không có tab nào đang đăng nhập (hoặc trình duyệt không hỗ trợ)
// → null sau `choMs`. Chỉ chờ khi tab này CHƯA có phiên, nên tab đã đăng nhập không bị chậm.
export function xinPhienTuTabKhac(choMs = 300): Promise<PhienChiaSe | null> {
  if (!coKenh()) return Promise.resolve(null)
  return new Promise((resolve) => {
    const kenh = new BroadcastChannel(TEN_KENH)
    const xong = (kq: PhienChiaSe | null): void => {
      clearTimeout(hen)
      kenh.close()
      resolve(kq)
    }
    const hen = setTimeout(() => xong(null), choMs)
    kenh.onmessage = (e: MessageEvent<unknown>) => {
      const tin = docTin(e.data)
      if (tin?.loai === 'tra') xong(tin.phien)
    }
    kenh.postMessage({ loai: 'xin' } satisfies TinNhan)
  })
}

export interface KenhPhien {
  phatDangNhap(phien: PhienChiaSe): void
  phatDangXuat(): void
  dong(): void
}

// Kênh sống suốt vòng đời tab (auth.store mở 1 lần). Trình duyệt không hỗ trợ → các hàm phát
// thành no-op: app vẫn chạy, chỉ mất tính năng đồng bộ giữa tab.
export function moKenhPhien(xuLy: {
  layPhien: () => PhienChiaSe | null
  khiNhanDangNhap: (phien: PhienChiaSe) => void
  khiNhanDangXuat: () => void
}): KenhPhien {
  if (!coKenh()) return { phatDangNhap() {}, phatDangXuat() {}, dong() {} }
  const kenh = new BroadcastChannel(TEN_KENH)
  // postMessage ném DataCloneError nếu dữ liệu có Proxy reactive của Vue — không được để lỗi đó
  // làm hỏng đăng nhập/đăng xuất ở tab hiện tại, chỉ mất phần đồng bộ sang tab khác.
  const gui = (tin: TinNhan): void => {
    try {
      kenh.postMessage(tin)
    } catch (loi) {
      console.warn('[phienGiuaTab] Không gửi được sang tab khác:', loi)
    }
  }
  // Chỉ có ở Node (test): kênh mở suốt vòng đời store không được giữ tiến trình sống.
  ;(kenh as BroadcastChannel & { unref?: () => void }).unref?.()
  kenh.onmessage = (e: MessageEvent<unknown>) => {
    const tin = docTin(e.data)
    if (!tin) return
    if (tin.loai === 'xin') {
      const phien = xuLy.layPhien()
      if (phien) gui({ loai: 'tra', phien })
    } else if (tin.loai === 'dang-nhap') {
      xuLy.khiNhanDangNhap(tin.phien)
    } else if (tin.loai === 'dang-xuat') {
      xuLy.khiNhanDangXuat()
    }
  }
  return {
    phatDangNhap: (phien) => gui({ loai: 'dang-nhap', phien }),
    phatDangXuat: () => gui({ loai: 'dang-xuat' }),
    dong: () => kenh.close()
  }
}

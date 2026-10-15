// Helper CHỈ DÙNG TRONG TEST: tính giá trị CSS "đã áp" cho một phần tử DOM thật (jsdom) từ file
// nguồn (.css và khối <style> của .vue). Vì sao tự làm: vitest không nạp CSS vào jsdom, và
// getComputedStyle của jsdom không xử lý đủ var()/kế thừa. Đọc file nguồn + dùng el.matches()
// của jsdom để khớp selector → test bắt được cả luật toàn cục (style.css) lẫn luật scoped đè lên
// nhau, thay vì chỉ grep 1 dòng rồi tin nhầm.
//
// Giới hạn có chủ đích (đủ cho các màn hiện tại, nói rõ để khỏi tin quá mức):
// - Bỏ qua @media trừ khi truyền `media` khớp đúng chuỗi điều kiện; bỏ qua @keyframes/@font-face.
// - Không xử lý :hover/:focus (el.matches trả false) và pseudo-element (::before…).
// - Nền gradient/ảnh → ném lỗi thay vì đoán màu.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface LuatCss {
  selector: string
  khaiBao: Map<string, { giaTri: string; quanTrong: boolean }>
  thuTu: number
  // Vue thêm [data-v-xxx] vào selector của khối scoped → +1 bậc lớp ở độ ưu tiên.
  scoped: boolean
  media: string | null
}

let demThuTu = 0

function boComment(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Tách theo ký tự phân cách ở mức ngoặc 0 (không tách bên trong url(), :is(), chuỗi).
function tachMuc0(s: string, kyTu: string): string[] {
  const kq: string[] = []
  let sau = 0
  let tu = 0
  let nhay: string | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (nhay) {
      if (c === nhay) nhay = null
      continue
    }
    if (c === '"' || c === "'") nhay = c
    else if (c === '(' || c === '[') sau++
    else if (c === ')' || c === ']') sau--
    else if (c === kyTu && sau === 0) {
      kq.push(s.slice(tu, i))
      tu = i + 1
    }
  }
  kq.push(s.slice(tu))
  return kq.map((x) => x.trim()).filter(Boolean)
}

function docKhaiBao(than: string): LuatCss['khaiBao'] {
  const kq: LuatCss['khaiBao'] = new Map()
  for (const dong of tachMuc0(than, ';')) {
    const hai = dong.indexOf(':')
    if (hai < 0) continue
    const ten = dong.slice(0, hai).trim().toLowerCase()
    let giaTri = dong.slice(hai + 1).trim()
    const quanTrong = /!important$/i.test(giaTri)
    if (quanTrong) giaTri = giaTri.replace(/\s*!important$/i, '').trim()
    kq.set(ten, { giaTri, quanTrong })
  }
  return kq
}

function docKhoi(css: string, scoped: boolean, media: string | null, kq: LuatCss[]): void {
  let i = 0
  while (i < css.length) {
    const mo = css.indexOf('{', i)
    if (mo < 0) break
    const dau = css.slice(i, mo).trim()
    // Tìm ngoặc đóng tương ứng (khối có thể lồng: @media).
    let sau = 1
    let j = mo + 1
    while (j < css.length && sau > 0) {
      if (css[j] === '{') sau++
      else if (css[j] === '}') sau--
      j++
    }
    const than = css.slice(mo + 1, j - 1)
    if (dau.startsWith('@media')) {
      docKhoi(than, scoped, dau.slice('@media'.length).trim(), kq)
    } else if (!dau.startsWith('@')) {
      kq.push({ selector: dau, khaiBao: docKhaiBao(than), thuTu: demThuTu++, scoped, media })
    }
    i = j
  }
}

// Đọc luật CSS từ file (.css hoặc khối <style> trong .vue), đường dẫn tính từ `goc`
// (import.meta.url của file test). Nhận chuỗi chứ không nhận URL: Vite viết lại
// `new URL('literal', import.meta.url)` thành URL tài nguyên http://…, readFileSync không đọc được.
export function docLuat(duongDan: string, goc: string): LuatCss[] {
  const url = new URL(duongDan, goc)
  const nguon = readFileSync(fileURLToPath(url.href), 'utf8').replace(/\r\n/g, '\n')
  const kq: LuatCss[] = []
  if (url.pathname.endsWith('.vue')) {
    const re = /<style([^>]*)>([\s\S]*?)<\/style>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(nguon))) docKhoi(boComment(m[2]), /\bscoped\b/.test(m[1]), null, kq)
  } else {
    docKhoi(boComment(nguon), false, null, kq)
  }
  return kq
}

type UuTien = [number, number, number]

function cong(a: UuTien, b: UuTien): UuTien {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
function lonHon(a: UuTien, b: UuTien): boolean {
  for (let k = 0; k < 3; k++) if (a[k] !== b[k]) return a[k] > b[k]
  return false
}

// Độ ưu tiên (specificity) theo CSS Selectors 4: :is/:not/:has lấy nhánh cao nhất, :where = 0.
export function doUuTien(sel: string): UuTien {
  let tong: UuTien = [0, 0, 0]
  let s = sel
  for (;;) {
    const m = /:(is|not|has|where)\(/.exec(s)
    if (!m) break
    let sau = 1
    let j = m.index + m[0].length
    while (j < s.length && sau > 0) {
      if (s[j] === '(') sau++
      else if (s[j] === ')') sau--
      j++
    }
    const trong = s.slice(m.index + m[0].length, j - 1)
    if (m[1] !== 'where') {
      let max: UuTien = [0, 0, 0]
      for (const nhanh of tachMuc0(trong, ',')) {
        const u = doUuTien(nhanh)
        if (lonHon(u, max)) max = u
      }
      tong = cong(tong, max)
    }
    s = s.slice(0, m.index) + ' ' + s.slice(j)
  }
  s = s.replace(/\[[^\]]*\]/g, () => {
    tong = cong(tong, [0, 1, 0])
    return ' '
  })
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, () => {
    tong = cong(tong, [0, 0, 1])
    return ' '
  })
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, () => {
    tong = cong(tong, [0, 1, 0])
    return ' '
  })
  s = s.replace(/#[\w-]+/g, () => {
    tong = cong(tong, [1, 0, 0])
    return ' '
  })
  s = s.replace(/\.[\w-]+/g, () => {
    tong = cong(tong, [0, 1, 0])
    return ' '
  })
  for (const tu of s.split(/[\s>+~]+/)) if (/^[a-zA-Z][\w-]*$/.test(tu)) tong = cong(tong, [0, 0, 1])
  return tong
}

function khop(el: Element, sel: string): boolean {
  try {
    return el.matches(sel)
  } catch {
    return false // :focus-visible, ::before… — không áp cho trạng thái tĩnh đang kiểm
  }
}

export interface TuyChon {
  // Chuỗi điều kiện @media coi như đang đúng, VD '(max-width: 480px)'.
  media?: string[]
}

// Giá trị khai báo thắng cascade cho đúng phần tử (chưa kế thừa, chưa giải var()).
export function giaTriKhaiBao(el: Element, thuocTinh: string, luat: LuatCss[], tc: TuyChon = {}): string | null {
  const tenXet = thuocTinh === 'background-color' ? ['background', 'background-color'] : [thuocTinh]
  let thang: { quanTrong: boolean; uuTien: UuTien; thuTu: number; giaTri: string } | null = null
  for (const l of luat) {
    if (l.media !== null && !(tc.media ?? []).includes(l.media)) continue
    for (const ten of tenXet) {
      const kb = l.khaiBao.get(ten)
      if (!kb) continue
      for (const nhanh of tachMuc0(l.selector, ',')) {
        if (!khop(el, nhanh)) continue
        const uuTien = cong(doUuTien(nhanh), l.scoped ? [0, 1, 0] : [0, 0, 0])
        const ungVien = { quanTrong: kb.quanTrong, uuTien, thuTu: l.thuTu, giaTri: kb.giaTri }
        const tot =
          !thang ||
          (ungVien.quanTrong !== thang.quanTrong
            ? ungVien.quanTrong
            : lonHon(uuTien, thang.uuTien) || (!lonHon(thang.uuTien, uuTien) && ungVien.thuTu > thang.thuTu))
        if (tot) thang = ungVien
      }
    }
  }
  return thang ? thang.giaTri : null
}

const KE_THUA = new Set(['color', 'color-scheme', 'font-size'])

function giaiVar(el: Element, giaTri: string, luat: LuatCss[], tc: TuyChon): string {
  for (;;) {
    const i = giaTri.indexOf('var(')
    if (i < 0) return giaTri
    let sau = 1
    let j = i + 4
    while (j < giaTri.length && sau > 0) {
      if (giaTri[j] === '(') sau++
      else if (giaTri[j] === ')') sau--
      j++
    }
    const [ten, ...duPhong] = tachMuc0(giaTri.slice(i + 4, j - 1), ',')
    const v = giaTriTinhToan(el, ten, luat, tc) ?? (duPhong.length ? duPhong.join(',') : null)
    if (v === null) throw new Error(`Không giải được ${ten}`)
    giaTri = giaTri.slice(0, i) + v + giaTri.slice(j)
  }
}

// Giá trị dùng thật: cascade + kế thừa (color, biến --x…) + giải var().
export function giaTriTinhToan(el: Element, thuocTinh: string, luat: LuatCss[], tc: TuyChon = {}): string | null {
  const v = giaTriKhaiBao(el, thuocTinh, luat, tc)
  const keThua = KE_THUA.has(thuocTinh) || thuocTinh.startsWith('--')
  if ((v === null && keThua) || v === 'inherit') {
    return el.parentElement ? giaTriTinhToan(el.parentElement, thuocTinh, luat, tc) : null
  }
  return v === null ? null : giaiVar(el, v, luat, tc)
}

export type Rgba = [number, number, number, number]

export function docMau(s: string): Rgba {
  const v = s.trim().toLowerCase()
  if (v === 'transparent' || v === 'none') return [0, 0, 0, 0]
  if (v === 'white' || v === '#fff') return [255, 255, 255, 1]
  if (v === 'black') return [0, 0, 0, 1]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
  }
  const rgb = /^rgba?\(([^)]*)\)$/.exec(v)
  if (rgb) {
    const so = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [so[0], so[1], so[2], so.length > 3 ? so[3] : 1]
  }
  throw new Error(`Không đọc được màu: "${s}"`)
}

// Phủ màu trên lên màu dưới (dưới phải đục).
function phu(tren: Rgba, duoi: Rgba): Rgba {
  const a = tren[3]
  return [tren[0] * a + duoi[0] * (1 - a), tren[1] * a + duoi[1] * (1 - a), tren[2] * a + duoi[2] * (1 - a), 1]
}

// Nền thật phía sau phần tử: phủ dần các lớp nền từ gốc xuống (nền bán trong suốt được trộn).
export function mauNen(el: Element, luat: LuatCss[], tc: TuyChon = {}): Rgba {
  const lop: Rgba[] = []
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = giaTriKhaiBao(n, 'background-color', luat, tc)
    if (v === null) continue
    const m = docMau(giaiVar(n, v, luat, tc))
    if (m[3] > 0) lop.push(m)
    if (m[3] === 1) break
  }
  let kq: Rgba = [255, 255, 255, 1]
  for (let i = lop.length - 1; i >= 0; i--) kq = phu(lop[i], kq)
  return kq
}

function doSang([r, g, b]: Rgba): number {
  const kenh = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * kenh(r) + 0.7152 * kenh(g) + 0.0722 * kenh(b)
}

// Tỉ lệ tương phản WCAG 2.x giữa chữ (có thể bán trong suốt) và nền.
export function tiLeTuongPhan(chu: Rgba, nen: Rgba): number {
  const c = chu[3] < 1 ? phu(chu, nen) : chu
  const l1 = doSang(c)
  const l2 = doSang(nen)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// Tương phản chữ/nền của phần tử theo luật đã đọc. Không có luật màu nào → chữ đen mặc định.
export function tuongPhanCua(el: Element, luat: LuatCss[], tc: TuyChon = {}): number {
  const chu = docMau(giaTriTinhToan(el, 'color', luat, tc) ?? '#000000')
  return tiLeTuongPhan(chu, mauNen(el, luat, tc))
}

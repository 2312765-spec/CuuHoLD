// Quét CSS của các màn đã rà cỡ chữ (Rescuer, Dashboard, Hồ sơ, Đăng nhập): chữ phụ/ghi chú
// không được dưới 13px, nhãn + nội dung không dưới 14px. Trước đây nhiều chữ 11–12px, khó đọc
// với người lớn tuổi/ngoài trời nắng. Đọc thẳng file nguồn nên thêm selector mới nhỏ hơn mức
// sàn sẽ đỏ ngay, thay vì phải nhớ rà bằng mắt.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = [
  '../views/RescuerView.vue',
  '../views/DashboardView.vue',
  '../views/HoSoView.vue',
  '../components/AuthModal.vue'
]

// Ngoại lệ CÓ CHỦ ĐÍCH (selector → lý do). Hiện không có: huy hiệu số trên marker bản đồ nằm
// ở RescueMap.vue/map-style.css, ngoài phạm vi các file này. Thêm ngoại lệ phải kèm lý do.
const NGOAI_LE: Record<string, string> = {}

// Selector là NHÃN hoặc NỘI DUNG (sàn 14px) — còn lại là chữ phụ/ghi chú (sàn 13px).
const SAN_14 = [
  '.rescuer-user', '.panel-empty', '.dashboard-user', '.map-che-do', '.sos-victim', '.team-item b',
  '.dash-export', '.dash-search', '.dash-selects select', '.dash-clear', '.modal-sub', '.modal-mo-ta',
  '.ho-so-dl div', '.ho-so-mo-ta', '.ho-so-trang-thai-tb', '.ho-so-form label', '.ho-so-loi',
  '.auth-sub', '.auth-modal label', '.auth-modal input'
]

function docKhaiBao(file: string): { selector: string; px: number }[] {
  const s = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
  const css = s.slice(s.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '')
  const kq: { selector: string; px: number }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const fz = m[2].match(/font-size:\s*([\d.]+)px/)
    if (fz) kq.push({ selector: m[1].trim().replace(/\s+/g, ' '), px: Number(fz[1]) })
  }
  return kq
}

describe.each(FILE)('cỡ chữ tối thiểu — %s', (file) => {
  const khaiBao = docKhaiBao(file)

  it('đọc được các khai báo font-size', () => {
    expect(khaiBao.length).toBeGreaterThan(3)
  })

  it('không còn chữ nào dưới 13px (trừ ngoại lệ có lý do)', () => {
    const nho = khaiBao.filter((k) => k.px < 13 && !(k.selector in NGOAI_LE))
    expect(nho).toEqual([])
  })

  it('nhãn và nội dung không dưới 14px', () => {
    const thap = khaiBao.filter((k) => SAN_14.includes(k.selector) && k.px < 14)
    expect(thap).toEqual([])
  })
})

// Mọi trang có nền sáng cố định (--fog) phải nằm trong danh sách "vùng luôn nền sáng" của
// style.css. Thiếu thì bật chế độ tối sẽ thành chữ kem trên nền kem — tiêu đề, nhãn gần như
// vô hình. Đã gặp thật: Hệ thống, Thống kê, Người dùng, Báo cáo sự cố (2026-11-18).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const THU_MUC = dirname(fileURLToPath(import.meta.url))
const STYLE = readFileSync(join(THU_MUC, '../assets/style.css'), 'utf8')

// 3 danh sách :is(...) dark-mode trong style.css (tiêu đề, nút viền, chữ gốc).
const DANH_SACH = [...STYLE.matchAll(/:root\[data-theme="dark"\] :is\(([^)]*)\)/g)]
  .map((m) => m[1])
  .filter((ds) => ds.includes('.dashboard-page'))

function trangNenSang(): string[] {
  const ketQua: string[] = []
  for (const tep of readdirSync(THU_MUC).filter((t) => t.endsWith('View.vue'))) {
    const nd = readFileSync(join(THU_MUC, tep), 'utf8')
    const goc = nd.match(/<template>\s*<(?:div|main|section) class="([a-z-]+)/)?.[1]
    if (!goc) continue
    const khoi = nd.match(new RegExp(`\\n\\.${goc} \\{([^}]*)\\}`))?.[1] ?? ''
    if (/background:\s*var\(--fog\)/.test(khoi)) ketQua.push(goc)
  }
  return ketQua
}

describe('Trang nền sáng ở chế độ tối', () => {
  it('style.css có đủ 3 danh sách vùng nền sáng', () => {
    expect(DANH_SACH).toHaveLength(3)
  })

  it.each(trangNenSang())('.%s nằm trong cả 3 danh sách', (lop) => {
    for (const ds of DANH_SACH) expect(ds).toContain(`.${lop}`)
  })

  it('tìm thấy các trang chính (không lọc nhầm thành rỗng)', () => {
    expect(trangNenSang()).toEqual(
      expect.arrayContaining(['dashboard-page', 'system-page', 'stats-page', 'users-page', 'report-page'])
    )
  })
})

// Chế độ riêng tư / trình duyệt chặn dữ liệu trang → localStorage ném lỗi. useTheme và
// useOnboarding đọc localStorage NGAY lúc import, nên lỗi đó từng có thể làm trắng cả app.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { docLocal, ghiLocal, xoaLocal } from './khoLuuTru'

afterEach(() => {
  vi.unstubAllGlobals()
})

function khoNemLoi(): Storage {
  const nem = () => {
    throw new DOMException('Access is denied for this document.', 'SecurityError')
  }
  return { getItem: nem, setItem: nem, removeItem: nem, clear: nem, key: nem, length: 0 }
}

function khoBoNho(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    }
  }
}

describe('khoLuuTru', () => {
  it('đọc/ghi/xoá bình thường khi localStorage hoạt động', () => {
    vi.stubGlobal('localStorage', khoBoNho())
    ghiLocal('k', 'v')
    expect(docLocal('k')).toBe('v')
    xoaLocal('k')
    expect(docLocal('k')).toBeNull()
  })

  it('localStorage ném lỗi → đọc trả null, ghi/xoá không ném', () => {
    vi.stubGlobal('localStorage', khoNemLoi())
    expect(docLocal('k')).toBeNull()
    expect(() => ghiLocal('k', 'v')).not.toThrow()
    expect(() => xoaLocal('k')).not.toThrow()
  })

  it('useTheme nạp được khi localStorage ném lỗi (không làm sập app lúc import)', async () => {
    vi.stubGlobal('localStorage', khoNemLoi())
    vi.resetModules()
    const { useTheme } = await import('@/composables/useTheme')
    const { theme, chuyenTheme } = useTheme()
    expect(['light', 'dark']).toContain(theme.value)
    expect(() => chuyenTheme()).not.toThrow()
  })

  it('useOnboarding nạp được khi localStorage ném lỗi', async () => {
    vi.stubGlobal('localStorage', khoNemLoi())
    vi.resetModules()
    const { useOnboarding } = await import('@/composables/useOnboarding')
    const { hoanTat, dangMo } = useOnboarding()
    expect(() => hoanTat()).not.toThrow()
    expect(dangMo.value).toBe(false)
  })
})

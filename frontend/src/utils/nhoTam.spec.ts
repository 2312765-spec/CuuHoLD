import { describe, it, expect } from 'vitest'
import { docTam, ghiTam, xoaHetTam } from './nhoTam'

describe('nhoTam', () => {
  it('đọc lại đúng giá trị đã ghi; xoaHetTam (đăng xuất) xoá sạch', () => {
    ghiTam('a', [1, 2])
    expect(docTam<number[]>('a')).toEqual([1, 2])
    expect(docTam('khong-co')).toBeUndefined()
    xoaHetTam()
    expect(docTam('a')).toBeUndefined()
  })
})

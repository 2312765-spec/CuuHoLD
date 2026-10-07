import { describe, it, expect } from 'vitest'
import { tinhKichThuocMoi } from './image'

describe('tinhKichThuocMoi', () => {
  it('giữ nguyên ảnh nhỏ hơn giới hạn', () => {
    expect(tinhKichThuocMoi(800, 600)).toEqual({ w: 800, h: 600 })
  })
  it('thu nhỏ theo cạnh dài, giữ tỉ lệ (ảnh ngang)', () => {
    expect(tinhKichThuocMoi(4000, 3000)).toEqual({ w: 1280, h: 960 })
  })
  it('thu nhỏ theo cạnh dài, giữ tỉ lệ (ảnh dọc chụp điện thoại)', () => {
    expect(tinhKichThuocMoi(3024, 4032)).toEqual({ w: 960, h: 1280 })
  })
})

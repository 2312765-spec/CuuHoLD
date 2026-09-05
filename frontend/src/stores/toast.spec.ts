// Test hành vi HÀNG ĐỢI của toast — trước khi sửa, mỗi showToast() ghi đè message cũ ngay
// lập tức nên dồn dập nhiều sự kiện chỉ còn thấy toast cuối, các cái trước mất trắng.
// Test này khoá lại đúng hành vi mới: xếp hàng, hiện lần lượt, không mất thông tin.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useToastStore } from './toast'

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hiện toast đầu tiên ngay lập tức', () => {
    const store = useToastStore()
    store.showToast('Xin chào')

    expect(store.visible).toBe(true)
    expect(store.message).toBe('Xin chào')
  })

  it('gọi dồn dập → xếp hàng đợi, hiện LẦN LƯỢT từng cái, không ghi đè mất thông tin', () => {
    const store = useToastStore()
    store.showToast('Thứ nhất')
    store.showToast('Thứ hai')
    store.showToast('Thứ ba')

    // Trước đây: gọi 3 lần liên tiếp thì chỉ 'Thứ ba' còn tồn tại, 2 cái trước mất luôn.
    expect(store.message).toBe('Thứ nhất')
    expect(store.visible).toBe(true)

    vi.advanceTimersByTime(3200) // hết thời gian hiện mặc định
    expect(store.visible).toBe(false) // đang ẩn để chuyển tiếp, chưa đổi message
    expect(store.message).toBe('Thứ nhất')

    vi.advanceTimersByTime(300) // hết khoảng chờ chuyển tiếp
    expect(store.message).toBe('Thứ hai')
    expect(store.visible).toBe(true)

    vi.advanceTimersByTime(3200)
    vi.advanceTimersByTime(300)
    expect(store.message).toBe('Thứ ba')
    expect(store.visible).toBe(true)

    vi.advanceTimersByTime(3200)
    vi.advanceTimersByTime(300)
    expect(store.visible).toBe(false) // hết hàng đợi, không còn gì để hiện tiếp
  })

  it('tự ẩn đúng theo durationMs tuỳ chỉnh, không cứng 3200ms', () => {
    const store = useToastStore()
    store.showToast('Thông báo ngắn', 500)

    expect(store.visible).toBe(true)
    vi.advanceTimersByTime(499)
    expect(store.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(store.visible).toBe(false)
  })
})

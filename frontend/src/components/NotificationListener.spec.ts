// Báo cáo sạt lở mới cần duyệt phải tới commander ở MỌI trang (chuông + toast), không chỉ khi
// đang mở Bảng điều phối như trước.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { HazardReportNewPayload } from '@/shared/socket-events.types'

const handlers: { onHazardReportNew?: (d: HazardReportNewPayload) => void } = {}
vi.mock('@/composables/useSocket', () => ({
  useSocket: (h: typeof handlers) => {
    Object.assign(handlers, h)
    return { connect: vi.fn(), disconnect: vi.fn() }
  }
}))
const tenTrang = { value: 'users' as string }
vi.mock('vue-router', () => ({ useRoute: () => ({ get name() { return tenTrang.value } }) }))

import NotificationListener from './NotificationListener.vue'
import { useNotificationStore } from '@/stores/notifications'
import { useToastStore } from '@/stores/toast'

const BAO_CAO: HazardReportNewPayload = {
  reportId: 'r1', mergedIntoReportId: null, type: 'landslide', reporterName: 'Nguyễn Văn B',
  wardCode: '24778', reporterCount: 1, createdAt: '2026-11-08T14:28:00Z'
}

beforeEach(() => setActivePinia(createPinia()))

describe('NotificationListener — báo cáo mới chờ duyệt', () => {
  it('ở trang khác Bảng điều phối: ghi vào chuông + hiện toast', () => {
    tenTrang.value = 'users'
    mount(NotificationListener)
    const toast = vi.spyOn(useToastStore(), 'showToast')
    handlers.onHazardReportNew!(BAO_CAO)
    const tb = useNotificationStore().danhSach[0]
    expect(tb.loai).toBe('bao-cao-moi')
    expect(tb.tieuDe).toContain('Báo cáo mới chờ duyệt')
    expect(tb.moTa).toContain('Nguyễn Văn B')
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('đang ở Bảng điều phối: vẫn ghi chuông nhưng không toast trùng (trang đó tự báo)', () => {
    tenTrang.value = 'dashboard'
    mount(NotificationListener)
    const toast = vi.spyOn(useToastStore(), 'showToast')
    handlers.onHazardReportNew!({ ...BAO_CAO, mergedIntoReportId: 'r0', reporterCount: 3 })
    expect(useNotificationStore().danhSach[0].tieuDe).toContain('3 người')
    expect(toast).not.toHaveBeenCalled()
  })
})

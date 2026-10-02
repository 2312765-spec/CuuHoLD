// Khoá hành vi dialog xác nhận SOS (SRS F-SOS-01: "countdown 5 giây").
// HÀNH VI THẬT của code (đã đọc SosConfirmDialog.vue, khác một chút so với cách nói "đếm xong
// mới gửi"): đếm ngược 5→0 chỉ để người dùng có thời gian huỷ; hết giờ KHÔNG tự gửi, và nút
// "Gửi ngay" bấm được ở BẤT KỲ lúc nào (kể cả đang đếm) — cố ý để người đang nguy cấp khỏi
// phải chờ. Các test dưới khoá đúng hành vi này; nếu team muốn "bắt buộc chờ hết 5s" thì đó là
// đổi hành vi, không phải sửa lỗi.
// Toạ độ + cờ vị trí ước tính KHÔNG nằm ở dialog (dialog chỉ trả loại + mô tả + ảnh) — phần đó
// do MapView.xacNhanGuiSos lo, xem MapView.spec.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SosConfirmDialog from './SosConfirmDialog.vue'

function moDialog(): VueWrapper {
  // Mount ở trạng thái đóng rồi mới mở: logic reset + đếm ngược nằm trong watch(isOpen).
  const w = mount(SosConfirmDialog, { props: { isOpen: false } })
  return w
}
async function mo(w: VueWrapper) {
  await w.setProps({ isOpen: true })
}
const nutGui = (w: VueWrapper) => w.find('.sos-confirm-btn')

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SosConfirmDialog — đếm ngược 5 giây', () => {
  it('mở dialog → nút ghi 5s, giảm mỗi giây, về 0 thì hiện "Gửi ngay" + "Sẵn sàng gửi."', async () => {
    const w = moDialog()
    await mo(w)
    expect(nutGui(w).text()).toBe('Gửi ngay (5s)')

    await vi.advanceTimersByTimeAsync(1000)
    expect(nutGui(w).text()).toBe('Gửi ngay (4s)')
    await vi.advanceTimersByTimeAsync(3000)
    expect(nutGui(w).text()).toBe('Gửi ngay (1s)')
    await vi.advanceTimersByTimeAsync(1000)

    expect(nutGui(w).text()).toBe('Gửi ngay')
    expect(w.find('.sos-dialog-hint').text()).toBe('Sẵn sàng gửi.')
  })

  it('hết giờ KHÔNG tự gửi — chỉ gửi khi người dùng bấm', async () => {
    const w = moDialog()
    await mo(w)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('bấm "Gửi ngay" giữa lúc đang đếm vẫn gửi được, kèm loại + mô tả đã chọn', async () => {
    const w = moDialog()
    await mo(w)
    await w.find('select').setValue('flood')
    await w.find('textarea').setValue('Nước dâng nhanh, 3 người')
    await vi.advanceTimersByTimeAsync(2000)

    await nutGui(w).trigger('click')

    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0][0]).toEqual({
      type: 'flood',
      description: 'Nước dâng nhanh, 3 người',
      anh: undefined
    })
    // Gửi xong thì đồng hồ dừng — không còn timer nào chạy ngầm.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('loại mặc định là "medical" khi người dùng không chọn gì', async () => {
    const w = moDialog()
    await mo(w)
    await nutGui(w).trigger('click')
    expect(w.emitted('confirm')![0][0]).toMatchObject({ type: 'medical', description: '' })
  })
})

describe('SosConfirmDialog — huỷ', () => {
  it('bấm Huỷ trong lúc đếm → emit cancel, KHÔNG confirm, và dù chờ thêm cũng không gửi', async () => {
    const w = moDialog()
    await mo(w)
    await vi.advanceTimersByTimeAsync(2000)

    await w.find('.sos-cancel-btn').trigger('click')
    // Component cha đóng dialog khi nhận cancel.
    await w.setProps({ isOpen: false })
    await vi.advanceTimersByTimeAsync(20_000)

    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('confirm')).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('nút ✕ và phím Esc cùng huỷ; Esc khi dialog đang đóng thì bỏ qua', async () => {
    const w = moDialog()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toBeUndefined()

    await mo(w)
    await w.find('.sos-dialog-close').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toHaveLength(2)
    w.unmount()
  })

  it('đóng rồi mở lại → đếm lại từ 5, và xoá mô tả/loại đã nhập lần trước', async () => {
    const w = moDialog()
    await mo(w)
    await w.find('textarea').setValue('cũ')
    await vi.advanceTimersByTimeAsync(3000)
    await w.setProps({ isOpen: false })

    await mo(w)

    expect(nutGui(w).text()).toBe('Gửi ngay (5s)')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('unmount giữa lúc đếm → không để lại timer và không còn nghe phím Esc', async () => {
    const w = moDialog()
    await mo(w)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toBeUndefined()
  })
})

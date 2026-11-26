// Danh sách xã/phường dùng chung cho mọi màn (tải 1 lần cho cả app, xem utils/xaPhuong.ts).
// tenXa(ma) đổi mã số ("24778") thành tên đọc được ("Phường Lâm Viên - Đà Lạt"); chưa tải xong
// hoặc mã lạ thì trả lại "Xã/phường <mã>" như cũ để không bao giờ hiện chuỗi rỗng.

import { computed, shallowRef } from 'vue'
import { taiDanhSachXa, tenDayDu, type XaPhuong } from '@/utils/xaPhuong'

const danhSachXa = shallowRef<XaPhuong[]>([])
let daYeuCau = false

function napNeuChua(): void {
  if (daYeuCau) return
  daYeuCau = true
  void taiDanhSachXa().then((ds) => {
    danhSachXa.value = ds
    // Tải lỗi (mất mạng lúc mở trang) → cho phép lần gọi sau thử lại.
    if (ds.length === 0) daYeuCau = false
  })
}

const theoMa = computed(() => new Map(danhSachXa.value.map((x) => [x.ma, x])))

export function useXaPhuong() {
  napNeuChua()

  function timXa(ma: string | null | undefined): XaPhuong | undefined {
    return ma ? theoMa.value.get(ma) : undefined
  }

  function tenXa(ma: string | null | undefined): string {
    if (!ma) return 'Ngoài ranh giới xã'
    const x = theoMa.value.get(ma)
    return x ? tenDayDu(x) : `Xã/phường ${ma}`
  }

  return { danhSachXa, timXa, tenXa }
}

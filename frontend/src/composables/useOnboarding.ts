// Hướng dẫn sử dụng lần đầu (F-UI-07). Giữ cờ ĐÃ XEM trong localStorage để chỉ tự hiện
// một lần cho người dùng mới; vẫn cho mở lại bất cứ lúc nào qua moLai() (VD gắn vào một
// mục "Hướng dẫn" ở menu sau này). State ở cấp module để dùng chung toàn app.

import { ref } from 'vue'
import { docLocal, ghiLocal } from '@/utils/khoLuuTru'

const KEY = 'rescue-onboarded'

const daHoanTat = ref(docLocal(KEY) === '1')
// Người mới (chưa có cờ) → mở sẵn ngay từ đầu.
const dangMo = ref(!daHoanTat.value)

export function useOnboarding() {
  function hoanTat(): void {
    daHoanTat.value = true
    ghiLocal(KEY, '1')
    dangMo.value = false
  }
  function moLai(): void {
    dangMo.value = true
  }
  function dong(): void {
    dangMo.value = false
  }
  return { dangMo, daHoanTat, hoanTat, moLai, dong }
}
// Bắt sự kiện 'beforeinstallprompt' — trình duyệt (Chrome/Edge/Android) tự bắn sự kiện
// này khi trang ĐÃ ĐỦ điều kiện PWA (manifest hợp lệ + Service Worker hoạt động). Ta lưu
// lại sự kiện đó để tự kích hoạt khi người dùng bấm nút riêng, thay vì chỉ trông chờ vào
// icon nhỏ trên thanh địa chỉ mà nhiều người không để ý tới.

import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let sukienCaiDat: BeforeInstallPromptEvent | null = null

export function useInstallPrompt() {
  const coTheCaiDat = ref(false)
  const laIOS = ref(false)
  const daCaiDatSan = ref(false)

  onMounted(() => {
    // 'display-mode: standalone' đúng khi app ĐANG chạy dưới dạng đã cài đặt —
    // không cần hiện nút cài đặt nữa trong trường hợp này.
    daCaiDatSan.value = window.matchMedia('(display-mode: standalone)').matches

    // iOS Safari KHÔNG hỗ trợ 'beforeinstallprompt' — không có cách nào chủ động
    // bật hộp thoại cài đặt bằng code trên iOS, chỉ có thể hướng dẫn thao tác thủ công.
    // iPad iPadOS 13+ báo userAgent giống macOS desktop (không có 'ipad'), nên bắt thêm
    // trường hợp thiết bị Mac CÓ cảm ứng (maxTouchPoints > 1) = thực chất là iPad.
    const ua = navigator.userAgent
    const laAppleCamUng =
      /iphone|ipad|ipod/i.test(ua) ||
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    laIOS.value = laAppleCamUng

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault() // chặn trình duyệt tự hiện popup mặc định, để mình chủ động kích hoạt sau
      sukienCaiDat = e as BeforeInstallPromptEvent
      coTheCaiDat.value = true
    })

    window.addEventListener('appinstalled', () => {
      coTheCaiDat.value = false
      sukienCaiDat = null
    })
  })

  async function caiDat() {
    if (!sukienCaiDat) return
    await sukienCaiDat.prompt()
    const { outcome } = await sukienCaiDat.userChoice
    if (outcome === 'accepted') coTheCaiDat.value = false
    sukienCaiDat = null
  }

  return { coTheCaiDat, laIOS, daCaiDatSan, caiDat }
}
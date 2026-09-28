// F-PWA-05 — xử lý Web Push trong service worker (CLAUDE.md Mục 15.17).
// Được nạp vào service worker do Workbox sinh ra qua `workbox.importScripts` trong
// vite.config.ts — nhờ vậy KHÔNG phải chuyển sang tự viết cả service worker (injectManifest),
// phần precache/offline F-PWA-03 giữ nguyên. File JS thuần: không qua Vite/TypeScript.
// Payload từ backend: { title, body, url, tag } — xem F-PWA-05-dac-ta-API-cho-B.md Mục 4.

// Chỉ nhận đường dẫn TƯƠNG ĐỐI trong app ('/map', '/lich-su'...). URL tuyệt đối, '//host' hay
// 'javascript:' bị thay bằng '/' — payload bị lợi dụng cũng không mở được trang lừa đảo.
function duongDanAnToan(url) {
  return typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : '/'
}

self.addEventListener('push', function (event) {
  var duLieu = {}
  if (event.data) {
    try {
      duLieu = event.data.json() || {}
    } catch (e) {
      duLieu = { body: event.data.text() }
    }
  }
  var tuyChon = {
    body: duLieu.body || '',
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    lang: 'vi',
    data: { url: duongDanAnToan(duLieu.url) }
  }
  // Cùng tag (VD 'sos-<id>') → thông báo mới THAY cái cũ và vẫn rung/kêu lại (renotify),
  // thay vì chất đống nhiều thông báo cho cùng 1 SOS.
  if (duLieu.tag) {
    tuyChon.tag = duLieu.tag
    tuyChon.renotify = true
  }
  event.waitUntil(self.registration.showNotification(duLieu.title || 'Cứu Trợ Lâm Đồng', tuyChon))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = duongDanAnToan(event.notification.data && event.notification.data.url)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (dsCuaSo) {
      // App đang mở → đưa lên trước và chuyển tới đúng trang, không mở thêm tab mới.
      for (var i = 0; i < dsCuaSo.length; i++) {
        var cuaSo = dsCuaSo[i]
        if ('focus' in cuaSo) {
          return cuaSo.focus().then(function () {
            return 'navigate' in cuaSo ? cuaSo.navigate(url) : undefined
          })
        }
      }
      return clients.openWindow(url)
    })
  )
})

// SRS F-PWA-02 — "Khi mất mạng, SOS được lưu vào IndexedDB. Service Worker tự gửi lên server khi
// kết nối trở lại (Background Sync)." (CLAUDE.md Mục 15.x)
//
// Nạp vào service worker Workbox qua `workbox.importScripts` (vite.config.ts), cạnh push-sw.js.
// File JS thuần, chạy trong service worker: không có Vite/idb/Pinia — đọc IndexedDB trực tiếp.
// Tên DB/store/khoá PHẢI khớp src/utils/offlineQueue.ts (DB 'cuutro-offline-db' v4).
//
// Luồng: trang lưu SOS vào 'sos-queue' + token vào 'phien-dong-bo' rồi đăng ký sync
// 'gui-sos-hang-doi'. Có mạng lại (kể cả khi app ĐÃ ĐÓNG) → trình duyệt đánh thức service
// worker → gửi từng SOS của người có phiên hợp lệ → xoá khỏi hàng đợi → hiện thông báo + báo
// cho tab đang mở (nếu có). Trình duyệt không hỗ trợ Background Sync (Safari, Firefox) → trang
// tự gửi khi mở lại app như trước (stores/offlineQueue.ts).
//
// Chống GỬI TRÙNG với trang: cả 2 phía lấy cùng khoá Web Locks 'gui-hang-doi-sos' và đọc lại
// hàng đợi BÊN TRONG khoá — mục phía kia đã gửi và xoá thì phía này không còn thấy.

var TEN_DB = 'cuutro-offline-db'
var STORE_SOS = 'sos-queue'
var STORE_PHIEN = 'phien-dong-bo'
var TAG_SYNC = 'gui-sos-hang-doi'
var TEN_KHOA = 'gui-hang-doi-sos'
// accessToken sống 24 giờ (api-contract: expiresIn 86400) — quá hạn thì không thử, để trang gửi
// khi người dùng mở app và đăng nhập lại.
var HAN_TOKEN_MS = 24 * 60 * 60 * 1000

function moDb() {
  return new Promise(function (resolve, reject) {
    // Mở KHÔNG kèm version: dùng đúng bản trang đã tạo. Nếu DB CHƯA tồn tại thì huỷ việc tạo —
    // tạo DB rỗng ở đây sẽ làm hỏng bước nâng cấp v1→v4 của trang (thiếu store).
    var yc = indexedDB.open(TEN_DB)
    yc.onupgradeneeded = function () {
      yc.transaction.abort()
    }
    yc.onsuccess = function () {
      resolve(yc.result)
    }
    yc.onerror = function () {
      reject(yc.error)
    }
  })
}

function layTatCa(db, store) {
  return new Promise(function (resolve, reject) {
    var yc = db.transaction(store, 'readonly').objectStore(store).getAll()
    yc.onsuccess = function () {
      resolve(yc.result || [])
    }
    yc.onerror = function () {
      reject(yc.error)
    }
  })
}

function xoa(db, store, khoa) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(khoa)
    tx.oncomplete = function () {
      resolve()
    }
    tx.onerror = function () {
      reject(tx.error)
    }
  })
}

// Trả về true nếu còn mục cần THỬ LẠI sau (mất mạng / server 5xx) — để trình duyệt lên lịch sync lại.
async function guiHangDoi() {
  var db
  try {
    db = await moDb()
  } catch (e) {
    return false
  }
  // DB có từ trước bản v4 (người dùng chưa mở phiên bản app mới) → chưa có store phiên, bỏ qua.
  if (!db.objectStoreNames.contains(STORE_PHIEN) || !db.objectStoreNames.contains(STORE_SOS)) {
    db.close()
    return false
  }
  var dsPhien = await layTatCa(db, STORE_PHIEN)
  var hangDoi = await layTatCa(db, STORE_SOS)
  var canThuLai = false
  var daGui = 0

  for (var i = 0; i < hangDoi.length; i++) {
    var muc = hangDoi[i]
    var phien = dsPhien.find(function (p) {
      return p.victimId === muc.victimId
    })
    // Không có phiên / token quá hạn → để trang xử lý khi chủ nhân mở app, KHÔNG gửi bằng token
    // của người khác (cùng lý do victimId trong types/offline.ts).
    if (!phien || Date.now() - new Date(phien.luuLuc).getTime() > HAN_TOKEN_MS) continue

    var noiDung = {
      lat: muc.lat,
      lng: muc.lng,
      type: muc.type,
      locationEstimated: muc.locationEstimated
    }
    if (muc.description) noiDung.description = muc.description

    var phanHoi
    try {
      phanHoi = await fetch(phien.apiBaseUrl.replace(/\/$/, '') + '/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + phien.accessToken },
        body: JSON.stringify(noiDung)
      })
    } catch (e) {
      canThuLai = true // vẫn chưa có mạng thật — trình duyệt sẽ gọi sync lại
      continue
    }
    if (phanHoi.ok) {
      var ketQua = null
      try {
        ketQua = (await phanHoi.json()).data
      } catch (e) {
        ketQua = null
      }
      await xoa(db, STORE_SOS, muc.localId)
      daGui++
      var dsCuaSo = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      dsCuaSo.forEach(function (c) {
        c.postMessage({ type: 'sos-da-gui', goc: muc, ketQua: ketQua })
      })
    } else if (phanHoi.status >= 500) {
      canThuLai = true
    }
    // 4xx (token hết hạn, đã có SOS đang hoạt động, bị giới hạn tần suất...) → GIỮ mục, không
    // thử lại vô ích: trang sẽ xử lý và hiện đúng thông báo khi người dùng mở app.
  }

  // Người nào hết SOS chờ gửi thì xoá luôn token của họ khỏi IndexedDB.
  var conLai = await layTatCa(db, STORE_SOS)
  for (var j = 0; j < dsPhien.length; j++) {
    var id = dsPhien[j].victimId
    if (!conLai.some(function (m) {
      return m.victimId === id
    })) {
      await xoa(db, STORE_PHIEN, id)
    }
  }
  db.close()

  if (daGui > 0) {
    await self.registration.showNotification('Đã gửi yêu cầu SOS', {
      body:
        daGui === 1
          ? 'Yêu cầu SOS lưu lúc mất mạng đã tới trung tâm điều phối.'
          : daGui + ' yêu cầu SOS lưu lúc mất mạng đã tới trung tâm điều phối.',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: 'sos-hang-doi',
      lang: 'vi',
      data: { url: '/map' }
    })
  }
  return canThuLai
}

async function guiHangDoiCoKhoa() {
  var canThuLai = self.navigator && self.navigator.locks
    ? await self.navigator.locks.request(TEN_KHOA, guiHangDoi)
    : await guiHangDoi()
  // Ném lỗi = báo trình duyệt "chưa xong", nó sẽ tự lên lịch sync lại (có giãn cách).
  if (canThuLai) throw new Error('Còn SOS chưa gửi được, thử lại sau')
}

self.addEventListener('sync', function (event) {
  if (event.tag === TAG_SYNC) event.waitUntil(guiHangDoiCoKhoa())
})

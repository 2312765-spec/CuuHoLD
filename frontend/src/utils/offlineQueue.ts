// Lớp bọc IndexedDB — CHỈ lo việc đọc/ghi hàng đợi, không biết gì về Pinia/Leaflet/UI.
// Dùng thư viện 'idb' để gọi IndexedDB bằng async/await thay vì callback kiểu cũ.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { QueuedBaoCao, QueuedSos, DiemVetGps, PhienDongBo } from '@/types/offline'

interface OfflineDB extends DBSchema {
  'bao-cao-queue': {
    key: string
    value: QueuedBaoCao
  }
  'sos-queue': {
    key: string
    value: QueuedSos
  }
  // v4 — F-PWA-04: các điểm GPS ghi định kỳ (mỗi 2 phút) của từng người dùng.
  'vet-gps': {
    key: number
    value: DiemVetGps
    indexes: { theoNguoiDung: string }
  }
  // v4 — F-PWA-02: token để SERVICE WORKER tự gửi SOS trong hàng đợi (Background Sync). Service
  // worker không đọc được sessionStorage (nơi auth.store lưu phiên), nên cần bản sao ở đây —
  // CHỈ tồn tại khi người đó còn SOS chờ gửi, xoá ngay khi hàng đợi của họ trống / đăng xuất.
  // Đọc trực tiếp (không qua idb) trong public/sos-sync-sw.js — đổi tên store/khoá phải sửa cả đó.
  'phien-dong-bo': {
    key: string
    value: PhienDongBo
  }
}

const DB_NAME = 'cuutro-offline-db'
const STORE_NAME = 'bao-cao-queue'
const SOS_STORE_NAME = 'sos-queue'
// v1 chỉ có bao-cao-queue (dữ liệu minh hoạ) — v2 thêm sos-queue cho SOS THẬT.
// v3 KHÔNG đổi cấu trúc store, chỉ xoá sạch sos-queue một lần: QueuedSos từ v3 bắt buộc có
// victimId, mà bản ghi cũ không có nên không thể xác định chủ nhân — giữ lại thì chúng vừa
// không bao giờ gửi được (không khớp người đăng nhập nào) vừa nằm chết trong máy người dùng.
// upgrade() nhận oldVersion nên trình duyệt đã có DB v1/v2 vẫn nâng cấp đúng.
// v4 thêm 2 store mới (vet-gps, phien-dong-bo), không đụng dữ liệu cũ.
const DB_VERSION = 4
const VET_GPS_STORE = 'vet-gps'
const PHIEN_STORE = 'phien-dong-bo'

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

function getDb() {
  // Chỉ mở kết nối 1 lần, tái sử dụng cho mọi lần gọi sau — mở lặp lại tốn tài nguyên
  // vô ích vì IndexedDB không đóng kết nối theo từng thao tác như fetch().
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'localId' })
        }
        if (oldVersion < 2) {
          db.createObjectStore(SOS_STORE_NAME, { keyPath: 'localId' })
        }
        // Chỉ dọn khi store đã tồn tại từ trước (oldVersion >= 2); nếu vừa tạo ở ngay trên
        // thì nó đang rỗng sẵn, không cần đụng tới.
        if (oldVersion >= 2 && oldVersion < 3) {
          transaction.objectStore(SOS_STORE_NAME).clear()
        }
        if (oldVersion < 4) {
          const vet = db.createObjectStore(VET_GPS_STORE, { keyPath: 'id', autoIncrement: true })
          vet.createIndex('theoNguoiDung', 'userId')
          db.createObjectStore(PHIEN_STORE, { keyPath: 'victimId' })
        }
      }
    })
  }
  return dbPromise
}

export async function themVaoHangDoi(baoCao: QueuedBaoCao): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, baoCao)
}

export async function layToanBoHangDoi(): Promise<QueuedBaoCao[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function xoaKhoiHangDoi(localId: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, localId)
}

export async function themSosVaoHangDoi(sos: QueuedSos): Promise<void> {
  const db = await getDb()
  await db.put(SOS_STORE_NAME, sos)
}

export async function layToanBoHangDoiSos(): Promise<QueuedSos[]> {
  const db = await getDb()
  return db.getAll(SOS_STORE_NAME)
}

export async function xoaKhoiHangDoiSos(localId: string): Promise<void> {
  const db = await getDb()
  await db.delete(SOS_STORE_NAME, localId)
}

// ---------- F-PWA-04: vết GPS ----------

export async function themDiemVetGps(diem: Omit<DiemVetGps, 'id'>): Promise<void> {
  const db = await getDb()
  await db.add(VET_GPS_STORE, diem as DiemVetGps)
}

// Các điểm của 1 người, sắp theo thời gian cũ → mới.
export async function layVetGps(userId: string): Promise<DiemVetGps[]> {
  const db = await getDb()
  const ds = await db.getAllFromIndex(VET_GPS_STORE, 'theoNguoiDung', userId)
  return ds.sort((a, b) => (a.luc < b.luc ? -1 : a.luc > b.luc ? 1 : 0))
}

export async function xoaVetGpsCuHon(userId: string, mocIso: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(VET_GPS_STORE, 'readwrite')
  let con = await tx.store.index('theoNguoiDung').openCursor(userId)
  while (con) {
    if (con.value.luc < mocIso) await con.delete()
    con = await con.continue()
  }
  await tx.done
}

export async function xoaToanBoVetGps(userId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(VET_GPS_STORE, 'readwrite')
  let con = await tx.store.index('theoNguoiDung').openCursor(userId)
  while (con) {
    await con.delete()
    con = await con.continue()
  }
  await tx.done
}

// ---------- F-PWA-02: phiên cho service worker gửi SOS nền ----------

export async function luuPhienDongBo(phien: PhienDongBo): Promise<void> {
  const db = await getDb()
  await db.put(PHIEN_STORE, phien)
}

export async function xoaPhienDongBo(victimId: string): Promise<void> {
  const db = await getDb()
  await db.delete(PHIEN_STORE, victimId)
}

export async function layPhienDongBo(victimId: string): Promise<PhienDongBo | undefined> {
  const db = await getDb()
  return db.get(PHIEN_STORE, victimId)
}

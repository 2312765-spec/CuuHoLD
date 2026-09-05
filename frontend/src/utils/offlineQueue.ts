// Lớp bọc IndexedDB — CHỈ lo việc đọc/ghi hàng đợi, không biết gì về Pinia/Leaflet/UI.
// Dùng thư viện 'idb' để gọi IndexedDB bằng async/await thay vì callback kiểu cũ.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { QueuedBaoCao, QueuedSos } from '@/types/offline'

interface OfflineDB extends DBSchema {
  'bao-cao-queue': {
    key: string
    value: QueuedBaoCao
  }
  'sos-queue': {
    key: string
    value: QueuedSos
  }
}

const DB_NAME = 'cuutro-offline-db'
const STORE_NAME = 'bao-cao-queue'
const SOS_STORE_NAME = 'sos-queue'
// v1 chỉ có bao-cao-queue (dữ liệu minh hoạ) — v2 thêm sos-queue cho SOS THẬT.
// upgrade() nhận oldVersion nên trình duyệt đã có DB v1 vẫn nâng cấp đúng, không mất dữ liệu cũ.
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

function getDb() {
  // Chỉ mở kết nối 1 lần, tái sử dụng cho mọi lần gọi sau — mở lặp lại tốn tài nguyên
  // vô ích vì IndexedDB không đóng kết nối theo từng thao tác như fetch().
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'localId' })
        }
        if (oldVersion < 2) {
          db.createObjectStore(SOS_STORE_NAME, { keyPath: 'localId' })
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
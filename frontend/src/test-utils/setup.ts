// Chạy trước MỌI file test (vitest.config.ts → setupFiles). Chặn tra tên đường qua Nominatim:
// test mount Bảng điều phối với SOS có toạ độ thật, không chặn thì mỗi lần chạy test (kể cả CI)
// gửi yêu cầu thật tới máy chủ OpenStreetMap. Test riêng của service dùng vi.unmock().
import { vi } from 'vitest'

vi.mock('@/services/diaChiService', () => ({
  layTenDuong: vi.fn(async () => null),
  tenDuongTuDiaChi: vi.fn(() => null)
}))

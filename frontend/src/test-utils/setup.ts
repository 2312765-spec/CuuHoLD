// Chạy trước MỌI file test (vitest.config.ts → setupFiles). Chặn tra tên đường: test mount Bảng
// điều phối với SOS có toạ độ thật, không chặn thì mỗi thẻ SOS gọi thêm /api/geocode/reverse
// vào adapter giả của từng test. Test riêng của service dùng vi.unmock().
import { vi } from 'vitest'

vi.mock('@/services/diaChiService', () => ({
  layTenDuong: vi.fn(async () => null)
}))

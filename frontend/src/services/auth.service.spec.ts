// F-UI-01 — khoá hợp đồng với backend (F-UI-01-dac-ta-API-cho-B.md): đúng route, đúng body,
// KHÔNG gửi kèm field nào ngoài name (backend forbidNonWhitelisted → 400, và wardCode/phone
// cố ý không cho sửa — xem đặc tả).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./http', () => ({ http: { patch: vi.fn() } }))

import { http } from './http'
import { capNhatHoSo, doiMatKhau } from './auth.service'

const patch = vi.mocked(http.patch)

beforeEach(() => patch.mockReset())

describe('auth.service — hồ sơ (F-UI-01)', () => {
  it('capNhatHoSo gửi PATCH /users/me chỉ với name, trả user mới', async () => {
    const user = { id: 'u1', name: 'Nguyễn Văn B' }
    patch.mockResolvedValueOnce({ data: { data: user } })

    expect(await capNhatHoSo('Nguyễn Văn B')).toEqual(user)
    expect(patch).toHaveBeenCalledWith('/users/me', { name: 'Nguyễn Văn B' })
  })

  it('doiMatKhau gửi PATCH /users/me/password với currentPassword + newPassword', async () => {
    patch.mockResolvedValueOnce({ data: { data: null } })

    await doiMatKhau('cu123456', 'moi456789')
    expect(patch).toHaveBeenCalledWith('/users/me/password', {
      currentPassword: 'cu123456',
      newPassword: 'moi456789'
    })
  })
})

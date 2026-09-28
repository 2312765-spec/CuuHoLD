import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SosHistoryQueryDto } from './sos-history-query.dto';

// Query string luôn là chuỗi ('2') — DTO phải tự đổi sang số và chặn giá trị vô lý
// (limit quá lớn = kéo cả bảng về 1 lần, page âm = OFFSET âm làm Postgres ném 500).
async function loi(query: Record<string, string>): Promise<string[]> {
  const errors = await validate(plainToInstance(SosHistoryQueryDto, query));
  return errors.map((e) => e.property);
}

describe('SosHistoryQueryDto', () => {
  it('không truyền gì vẫn hợp lệ (dùng mặc định)', async () => {
    expect(await loi({})).toEqual([]);
  });

  it('đổi chuỗi số trong query thành number', () => {
    const dto = plainToInstance(SosHistoryQueryDto, { page: '2', limit: '5' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(5);
  });

  it('chặn page < 1, limit > 50, số lẻ và chữ', async () => {
    expect(await loi({ page: '0' })).toEqual(['page']);
    expect(await loi({ limit: '51' })).toEqual(['limit']);
    expect(await loi({ page: '1.5' })).toEqual(['page']);
    expect(await loi({ limit: 'abc' })).toEqual(['limit']);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSosDto } from './create-sos.dto';

async function loiImageUrl(imageUrl: unknown): Promise<boolean> {
  const dto = plainToInstance(CreateSosDto, {
    lat: 11.94,
    lng: 108.44,
    type: 'flood',
    imageUrl,
  });
  const errors = await validate(dto);
  return errors.some((e) => e.property === 'imageUrl');
}

describe('CreateSosDto.imageUrl (SRS: VARCHAR(500), api-contract: đường dẫn https)', () => {
  it('nhận URL https hợp lệ', async () => {
    expect(await loiImageUrl('https://example.com/anh.jpg')).toBe(false);
  });

  it('không gửi imageUrl vẫn hợp lệ (field tuỳ chọn)', async () => {
    expect(await loiImageUrl(undefined)).toBe(false);
  });

  it('từ chối data-URI base64 (từng làm mất cả tín hiệu SOS)', async () => {
    expect(await loiImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(
      true,
    );
  });

  it("từ chối 'javascript:' và http không mã hoá", async () => {
    expect(await loiImageUrl('javascript:alert(1)')).toBe(true);
    expect(await loiImageUrl('http://example.com/anh.jpg')).toBe(true);
  });

  it('từ chối URL dài hơn 500 ký tự', async () => {
    expect(await loiImageUrl(`https://example.com/${'a'.repeat(500)}`)).toBe(
      true,
    );
  });
});

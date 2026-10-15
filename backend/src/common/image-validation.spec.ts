import { detectImageMime } from './image-validation';

describe('detectImageMime', () => {
  it('nhận JPEG theo magic bytes', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe(
      'image/jpeg',
    );
  });

  it('nhận PNG theo magic bytes', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(detectImageMime(png)).toBe('image/png');
  });

  it('nhận WebP (RIFF....WEBP)', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x10, 0, 0, 0]),
      Buffer.from('WEBPVP8 '),
    ]);
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  it('TỪ CHỐI SVG/HTML dù client khai báo là ảnh (có thể chứa script)', () => {
    expect(
      detectImageMime(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      ),
    ).toBeNull();
    expect(
      detectImageMime(Buffer.from('<html><script>alert(1)</script></html>')),
    ).toBeNull();
  });

  it('từ chối file rỗng / quá ngắn / định dạng khác (PDF, GIF)', () => {
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageMime(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(detectImageMime(Buffer.from('GIF89a'))).toBeNull();
  });
});

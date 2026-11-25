import {
  tileTrongVungPhucVu,
  tileX,
  tileY,
  TILE_MAX_ZOOM,
} from './tile-bounds';

describe('tileTrongVungPhucVu — chỉ proxy tile phủ tỉnh Lâm Đồng', () => {
  it('tile trung tâm Đà Lạt ở z13 → trong vùng', () => {
    const z = 13;
    expect(tileTrongVungPhucVu(z, tileX(108.44, z), tileY(11.94, z))).toBe(
      true,
    );
  });

  it('tile Phú Quý (đảo xa nhất phía đông nam) ở z16 → trong vùng', () => {
    const z = 16;
    expect(tileTrongVungPhucVu(z, tileX(108.93, z), tileY(10.52, z))).toBe(
      true,
    );
  });

  it('tile Hà Nội ở z13 → ngoài vùng (không làm proxy bản đồ toàn cầu)', () => {
    const z = 13;
    expect(tileTrongVungPhucVu(z, tileX(105.85, z), tileY(21.03, z))).toBe(
      false,
    );
  });

  it('zoom quá sâu → ngoài vùng', () => {
    const z = TILE_MAX_ZOOM + 1;
    expect(tileTrongVungPhucVu(z, tileX(108.44, z), tileY(11.94, z))).toBe(
      false,
    );
  });
});

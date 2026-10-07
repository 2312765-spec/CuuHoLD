import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { RoutingService } from './routing.service';
import type { GisService } from '../gis/gis.service';
import type { HazardsService } from '../hazards/hazards.service';

jest.mock('axios');

// Cast về shape phẳng { post: jest.Mock } thay vì jest.Mocked<typeof axios>: kiểu gốc của
// axios.post mang theo chữ ký "this"-typed (instance method thật) khiến
// @typescript-eslint/unbound-method báo lỗi false-positive mỗi lần tách riêng axios.post ra
// khỏi object để mock/assert — đây là axios đã bị jest.mock() thay hoàn toàn, không có "this"
// thật nào để mất khi tách ra cả.
const axiosMock = axios as unknown as {
  post: jest.Mock<Promise<unknown>, unknown[]>;
};

function buildConfig(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

// Mặc định coi mọi điểm nằm trong tỉnh — các test dưới đây tập trung vào phần gọi ORS, không
// phải phần kiểm tra ranh giới (có nhóm test riêng).
function buildGisService(inside = true): GisService {
  return {
    isPointInProvince: jest.fn().mockResolvedValue(inside),
  } as unknown as GisService;
}

// Mặc định không có cảnh báo/chặn đường nào active — các test tập trung vào phần ORS không
// phải lo field avoid_polygons xuất hiện trong body (có nhóm test riêng cho việc đó).
function buildHazardsService(
  avoidPolygons: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  } | null = null,
): HazardsService {
  return {
    findActiveAvoidPolygons: jest.fn().mockResolvedValue(avoidPolygons),
  } as unknown as HazardsService;
}

describe('RoutingService', () => {
  beforeEach(() => {
    axiosMock.post.mockReset();
  });

  describe('findRoute', () => {
    it('ném ServiceUnavailableException khi thiếu ORS_API_KEY, không gọi axios', async () => {
      const service = new RoutingService(
        buildConfig(),
        buildGisService(),
        buildHazardsService(),
      );

      await expect(
        service.findRoute(11.94, 108.44, 11.95, 108.45),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('ném BadRequestException khi điểm xuất phát ngoài tỉnh Lâm Đồng, không gọi axios', async () => {
      const gisService = {
        isPointInProvince: jest
          .fn()
          .mockResolvedValueOnce(false) // fromLat/fromLng — ngoài tỉnh
          .mockResolvedValueOnce(true), // toLat/toLng — trong tỉnh
      } as unknown as GisService;
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        gisService,
        buildHazardsService(),
      );

      await expect(
        service.findRoute(21.0, 105.8, 11.95, 108.45), // 21.0/105.8 ≈ Hà Nội
      ).rejects.toThrow(BadRequestException);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('ném BadRequestException khi điểm đến ngoài tỉnh Lâm Đồng, không gọi axios', async () => {
      const gisService = {
        isPointInProvince: jest
          .fn()
          .mockResolvedValueOnce(true) // fromLat/fromLng — trong tỉnh
          .mockResolvedValueOnce(false), // toLat/toLng — ngoài tỉnh
      } as unknown as GisService;
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        gisService,
        buildHazardsService(),
      );

      await expect(
        service.findRoute(11.94, 108.44, 21.0, 105.8),
      ).rejects.toThrow(BadRequestException);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('đảo đúng toạ độ GeoJSON [lng,lat] của ORS thành [lat,lng] cho Leaflet', async () => {
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(),
      );
      axiosMock.post.mockResolvedValue({
        data: {
          features: [
            {
              geometry: {
                coordinates: [
                  [108.44, 11.94],
                  [108.45, 11.95],
                ],
              },
              properties: {
                summary: { distance: 1626.4, duration: 145.4 },
                segments: [
                  {
                    steps: [
                      {
                        instruction: 'Rẽ phải vào Trần Phú',
                        distance: 500.2,
                        way_points: [0, 1],
                      },
                      {
                        instruction: 'Đã đến nơi',
                        distance: 0,
                        way_points: [1, 1],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await service.findRoute(11.94, 108.44, 11.95, 108.45);

      expect(result.geometry).toEqual([
        [11.94, 108.44],
        [11.95, 108.45],
      ]);
      expect(result.distance_meters).toBe(1626);
      expect(result.duration_seconds).toBe(145);
      expect(result.instructions).toEqual([
        {
          text: 'Rẽ phải vào Trần Phú',
          distance_meters: 500,
          lat: 11.94,
          lng: 108.44,
        },
        { text: 'Đã đến nơi', distance_meters: 0, lat: 11.95, lng: 108.45 },
      ]);

      // coordinates=[lng,lat] (CÙNG chiều với geometry trả về, khác GraphHopper) + header
      // Authorization đúng key cấu hình (không có tiền tố "Bearer").
      const [url, body, options] = axiosMock.post.mock.calls[0] as [
        string,
        { coordinates: number[][] },
        { headers: Record<string, string> },
      ];
      expect(url).toBe(
        'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson',
      );
      expect(body.coordinates).toEqual([
        [108.44, 11.94],
        [108.45, 11.95],
      ]);
      expect(options.headers.Authorization).toBe('secret');
      // ORS chỉ trả 1 feature (không tìm được tuyến thay thế đủ khác biệt) → không có field
      // alternate_geometry, không phải mảng rỗng.
      expect(result.alternate_geometry).toBeUndefined();
      expect(result.alternate_distance_meters).toBeUndefined();
    });

    it('xin alternative_routes trong body + đảo toạ độ tuyến thay thế khi ORS trả 2 features', async () => {
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(),
      );
      axiosMock.post.mockResolvedValue({
        data: {
          features: [
            {
              geometry: {
                coordinates: [
                  [108.44, 11.94],
                  [108.45, 11.95],
                ],
              },
              properties: {
                summary: { distance: 7084.1, duration: 597.5 },
                segments: [{ steps: [] }],
              },
            },
            {
              geometry: {
                coordinates: [
                  [108.44, 11.94],
                  [108.46, 11.96],
                ],
              },
              properties: {
                summary: { distance: 7982.2, duration: 623.1 },
                segments: [{ steps: [] }],
              },
            },
          ],
        },
      });

      const result = await service.findRoute(11.94, 108.44, 11.95, 108.45);

      expect(result.alternate_geometry).toEqual([
        [11.94, 108.44],
        [11.96, 108.46],
      ]);
      expect(result.alternate_distance_meters).toBe(7982);

      const [, body] = axiosMock.post.mock.calls[0] as [
        string,
        { alternative_routes: { target_count: number } },
      ];
      expect(body.alternative_routes).toEqual({
        target_count: 2,
        share_factor: 0.9,
        weight_factor: 2.0,
      });
    });

    it('ném ServiceUnavailableException khi axios lỗi/timeout', async () => {
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(),
      );
      axiosMock.post.mockRejectedValue(new Error('timeout of 8000ms exceeded'));

      await expect(
        service.findRoute(11.94, 108.44, 11.95, 108.45),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('ném ServiceUnavailableException khi ORS không tìm được tuyến đường (features rỗng)', async () => {
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(),
      );
      axiosMock.post.mockResolvedValue({ data: { features: [] } });

      await expect(
        service.findRoute(11.94, 108.44, 11.95, 108.45),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('gửi options.avoid_polygons khi có cảnh báo/chặn đường đang active', async () => {
      const avoidPolygons = {
        type: 'MultiPolygon' as const,
        coordinates: [
          [
            [
              [108.44, 11.94],
              [108.45, 11.94],
              [108.45, 11.95],
              [108.44, 11.94],
            ],
          ],
        ],
      };
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(avoidPolygons),
      );
      axiosMock.post.mockResolvedValue({
        data: {
          features: [
            {
              geometry: {
                coordinates: [
                  [108.44, 11.94],
                  [108.45, 11.95],
                ],
              },
              properties: {
                summary: { distance: 1000, duration: 100 },
                segments: [{ steps: [] }],
              },
            },
          ],
        },
      });

      await service.findRoute(11.94, 108.44, 11.95, 108.45);

      const [, body] = axiosMock.post.mock.calls[0] as [
        string,
        { options?: { avoid_polygons: unknown } },
      ];
      expect(body.options?.avoid_polygons).toEqual(avoidPolygons);
    });

    it('không gửi field options khi không có cảnh báo active nào (tránh đoán ORS xử lý mảng rỗng)', async () => {
      const service = new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(null),
      );
      axiosMock.post.mockResolvedValue({
        data: {
          features: [
            {
              geometry: {
                coordinates: [
                  [108.44, 11.94],
                  [108.45, 11.95],
                ],
              },
              properties: {
                summary: { distance: 1000, duration: 100 },
                segments: [{ steps: [] }],
              },
            },
          ],
        },
      });

      await service.findRoute(11.94, 108.44, 11.95, 108.45);

      const [, body] = axiosMock.post.mock.calls[0] as [
        string,
        { options?: unknown },
      ];
      expect(body.options).toBeUndefined();
    });
  });

  describe('pickBestTeamByRoad', () => {
    const AVOID = {
      type: 'MultiPolygon' as const,
      coordinates: [
        [
          [
            [108.44, 11.94],
            [108.45, 11.94],
            [108.45, 11.95],
            [108.44, 11.94],
          ],
        ],
      ],
    };
    // 3 đội, đã xếp theo đường chim bay (gần → xa); lat khác nhau để nhận ra đội trong body ORS.
    const teams = [0, 1, 2].map((i) => ({
      id: `t${i}`,
      name: `Đội ${i}`,
      lat: 11.9 + i * 0.01,
      lng: 108.4,
    }));
    const okRes = (duration: number) => ({
      data: {
        features: [
          { properties: { summary: { distance: duration * 10, duration } } },
        ],
      },
    });
    const noRoute = () =>
      Object.assign(new Error('404'), { response: { status: 404 } });
    const teamOf = (body: { coordinates: number[][] }) =>
      Math.round((body.coordinates[0][1] - 11.9) / 0.01);
    const hasAvoid = (body: { options?: unknown }) =>
      body.options !== undefined;

    const build = (avoid: typeof AVOID | null) =>
      new RoutingService(
        buildConfig({ ORS_API_KEY: 'secret' }),
        buildGisService(),
        buildHazardsService(avoid),
      );

    it('không có cảnh báo nào → giữ đội gần nhất đường chim bay, KHÔNG gọi ORS', async () => {
      const pick = await build(null).pickBestTeamByRoad(teams, 11.95, 108.45);
      expect(pick).toMatchObject({ mode: 'straight_line', team: teams[0] });
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('có cảnh báo → chọn đội đến NHANH NHẤT theo đường bộ, không phải đội gần nhất chim bay', async () => {
      const dur = [900, 300, 600];
      axiosMock.post.mockImplementation((_u, body) =>
        Promise.resolve(
          okRes(dur[teamOf(body as { coordinates: number[][] })]),
        ),
      );

      const pick = await build(AVOID).pickBestTeamByRoad(teams, 11.95, 108.45);

      expect(pick).toMatchObject({
        mode: 'road',
        team: teams[1],
        closerSkipped: 1,
      });
      expect(pick.travel).toEqual({
        distance_meters: 3000,
        duration_seconds: 300,
      });
      // mọi lượt tính đều gửi kèm vùng cảnh báo
      const bodies = axiosMock.post.mock.calls.map(
        (c) => c[1] as { options?: unknown },
      );
      expect(bodies.every(hasAvoid)).toBe(true);
    });

    it('đội gần nhất bị cảnh báo chặn hẳn (ORS 404 khi né, nhưng có đường khi không né) → loại, chọn đội kế', async () => {
      axiosMock.post.mockImplementation((_u, body) => {
        const b = body as { coordinates: number[][]; options?: unknown };
        const i = teamOf(b);
        if (i === 0 && hasAvoid(b)) return Promise.reject(noRoute());
        return Promise.resolve(okRes(500 + i * 100));
      });

      const pick = await build(AVOID).pickBestTeamByRoad(teams, 11.95, 108.45);

      expect(pick).toMatchObject({
        mode: 'road',
        team: teams[1],
        closerSkipped: 1,
      });
    });

    it('mọi đội đều bị cảnh báo chặn hẳn → blocked (không có đội nào được chọn)', async () => {
      axiosMock.post.mockImplementation((_u, body) =>
        hasAvoid(body as { options?: unknown })
          ? Promise.reject(noRoute())
          : Promise.resolve(okRes(600)),
      );

      const pick = await build(AVOID).pickBestTeamByRoad(teams, 11.95, 108.45);

      expect(pick).toMatchObject({ mode: 'blocked', team: null });
    });

    it('nạn nhân không nằm gần đường nào (404 cả khi KHÔNG có cảnh báo) → không phải do cảnh báo, giữ đội gần nhất chim bay', async () => {
      axiosMock.post.mockRejectedValue(noRoute());

      const pick = await build(AVOID).pickBestTeamByRoad(teams, 11.95, 108.45);

      expect(pick).toMatchObject({ mode: 'straight_line', team: teams[0] });
    });

    it('ORS lỗi/timeout → lùi về đội gần nhất đường chim bay, không bỏ rơi SOS', async () => {
      axiosMock.post.mockRejectedValue(new Error('timeout of 8000ms exceeded'));

      const pick = await build(AVOID).pickBestTeamByRoad(teams, 11.95, 108.45);

      expect(pick).toMatchObject({ mode: 'straight_line', team: teams[0] });
    });
  });
});

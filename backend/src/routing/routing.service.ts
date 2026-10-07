import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GisService } from '../gis/gis.service';
import { HazardsService } from '../hazards/hazards.service';

export interface RouteInstruction {
  text: string;
  distance_meters: number;
  // Toạ độ [lat, lng] điểm BẮT ĐẦU của bước rẽ này (way_points[0] của ORS, cùng đảo chiều
  // như geometry) — frontend dùng để biết rescuer đã "tới gần" điểm rẽ nào mà đọc to lên
  // (Web Speech API), không phải để vẽ gì thêm.
  lat: number;
  lng: number;
}

export interface RouteResult {
  distance_meters: number;
  duration_seconds: number;
  // [lat, lng] — đã đảo từ GeoJSON [lng, lat] của ORS, sẵn sàng cho Leaflet.
  geometry: [number, number][];
  instructions: RouteInstruction[];
  // Tuyến thay thế (gợi ý, không có instructions riêng — chỉ để vẽ nhạt hơn trên bản đồ).
  // undefined khi ORS không tìm được tuyến thay thế nào đủ khác biệt trong ràng buộc đã đặt
  // (ordinaryFactor/shareFactor bên dưới) — KHÔNG phải lỗi, chỉ là không có lựa chọn khác.
  alternate_geometry?: [number, number][];
  // Khoảng cách tuyến thay thế — frontend tự trừ với distance_meters để hiện "dài/ngắn hơn
  // bao nhiêu km". Luôn đi kèm alternate_geometry (cùng có hoặc cùng không).
  alternate_distance_meters?: number;
}

export interface TravelEstimate {
  distance_meters: number;
  duration_seconds: number;
}

// Kết quả chọn đội theo đường bộ thật:
// - 'road': chọn theo thời gian đi thật (đã né vùng cảnh báo).
// - 'straight_line': không tính được đường (ORS lỗi/điểm không nằm trên đường...) → giữ thứ tự
//   đường chim bay như cũ, KHÔNG để SOS bị bỏ rơi chỉ vì dịch vụ dẫn đường trục trặc.
// - 'blocked': mọi đội ứng viên đều bị cảnh báo chặn hẳn đường tới nạn nhân.
export type TeamPick<T> =
  | { mode: 'road'; team: T; travel: TravelEstimate; closerSkipped: number }
  | { mode: 'straight_line'; team: T; travel: null; closerSkipped: number }
  | { mode: 'blocked'; team: null; travel: null; closerSkipped: number };

export interface RoutableTeam {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

type AvoidPolygons = { type: 'MultiPolygon'; coordinates: number[][][][] };

function isOrsNoRoute(e: unknown): boolean {
  // ORS trả 404 khi không có tuyến / điểm không gần đường nào (mã 2009/2010) — khác lỗi dịch vụ.
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { response?: { status?: number } }).response?.status === 404
  );
}

interface OrsStep {
  instruction: string;
  distance: number;
  way_points: [number, number];
}

interface OrsFeature {
  geometry: { coordinates: [number, number][] };
  properties: {
    summary: { distance: number; duration: number };
    segments: { steps: OrsStep[] }[];
  };
}

interface OrsResponse {
  features?: OrsFeature[];
}

// URL cố định — OpenRouteService (HeiGIT, Đại học Heidelberg) là dịch vụ định tuyến MIỄN PHÍ
// dựa trên OSM (CLAUDE.md Mục 15.13, đổi từ hướng tự host GraphHopper trên Oracle VM lúc đầu
// sang dịch vụ có sẵn vì không muốn quản lý VM). Đã xác nhận trực tiếp (không đoán, gọi thử
// endpoint thật ngày 2026-09-22): base URL "https://api.heigit.org/openrouteservice", auth
// qua header Authorization (không có "Bearer "), POST .../geojson trả GeoJSON FeatureCollection.
const ORS_BASE_URL = 'https://api.heigit.org/openrouteservice/v2/directions';
const ORS_PROFILE = 'driving-car';

// Không throw khi thiếu cấu hình lúc boot (khác JWT_SECRET/DATABASE_URL): ORS_API_KEY có thể
// điền sau — thiếu chỉ khiến đúng route này trả 503, phần còn lại của backend vẫn chạy bình
// thường (frontend tự lùi về đường chim bay, xem routingService.ts phía frontend).
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private config: ConfigService,
    private gisService: GisService,
    private hazardsService: HazardsService,
  ) {}

  // Ước lượng thời gian/quãng đường đi bộ THẬT (đã né cảnh báo nếu truyền avoidPolygons). Trả
  // null khi ORS xác nhận KHÔNG có tuyến (bị chặn / điểm không gần đường); ném 503 khi dịch vụ
  // lỗi — hai trường hợp này phải phân biệt được, nên không gộp chung như findRoute().
  async estimateTravel(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    avoidPolygons: AvoidPolygons | null,
  ): Promise<TravelEstimate | null> {
    const apiKey = this.config.get<string>('ORS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Dịch vụ tìm đường chưa được cấu hình (thiếu ORS_API_KEY)',
      );
    }
    try {
      const res = await axios.post<OrsResponse>(
        `${ORS_BASE_URL}/${ORS_PROFILE}/geojson`,
        {
          coordinates: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
          instructions: false,
          ...(avoidPolygons
            ? { options: { avoid_polygons: avoidPolygons } }
            : {}),
        },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );
      const summary = res.data.features?.[0]?.properties.summary;
      if (!summary) return null;
      return {
        distance_meters: Math.round(summary.distance),
        duration_seconds: Math.round(summary.duration),
      };
    } catch (e: unknown) {
      if (isOrsNoRoute(e)) return null;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OpenRouteService estimate error: ${message}`);
      throw new ServiceUnavailableException(
        'Không kết nối được dịch vụ tìm đường',
      );
    }
  }

  // Chọn đội đến NHANH NHẤT theo đường bộ thật trong số các ứng viên (đã xếp theo đường chim
  // bay, gần → xa). Chỉ tốn lượt gọi ORS khi đang có cảnh báo chặn đường; không có cảnh báo nào
  // thì giữ nguyên đội đầu danh sách (đường chim bay) như trước.
  async pickBestTeamByRoad<T extends RoutableTeam>(
    candidates: T[],
    toLat: number,
    toLng: number,
  ): Promise<TeamPick<T>> {
    if (candidates.length === 0) {
      return { mode: 'blocked', team: null, travel: null, closerSkipped: 0 };
    }
    const avoid = await this.hazardsService.findActiveAvoidPolygons();
    if (!avoid) {
      return {
        mode: 'straight_line',
        team: candidates[0],
        travel: null,
        closerSkipped: 0,
      };
    }

    const settled = await Promise.allSettled(
      candidates.map((t) =>
        this.estimateTravel(t.lat, t.lng, toLat, toLng, avoid),
      ),
    );

    let bestIdx = -1;
    settled.forEach((r, i) => {
      if (r.status !== 'fulfilled' || r.value === null) return;
      const best = bestIdx >= 0 ? settled[bestIdx] : null;
      const bestDur =
        best && best.status === 'fulfilled' && best.value
          ? best.value.duration_seconds
          : Infinity;
      if (r.value.duration_seconds < bestDur) bestIdx = i;
    });
    if (bestIdx >= 0) {
      const r = settled[bestIdx] as PromiseFulfilledResult<TravelEstimate>;
      return {
        mode: 'road',
        team: candidates[bestIdx],
        travel: r.value,
        closerSkipped: bestIdx,
      };
    }

    // Không đội nào có tuyến khi né cảnh báo. Phải phân biệt: do CẢNH BÁO chặn (đáng loại đội đó)
    // hay do điểm đó vốn không nằm gần đường nào (nạn nhân/đội ở giữa rừng — không liên quan
    // cảnh báo, loại đội là sai). Thử lại KHÔNG né cảnh báo: có tuyến → bị cảnh báo chặn thật.
    const unknown: number[] = []; // chưa kết luận được → vẫn đủ điều kiện (xếp theo chim bay)
    for (let i = 0; i < candidates.length; i++) {
      const r = settled[i];
      if (r.status === 'rejected') {
        unknown.push(i);
        continue;
      }
      try {
        const t = candidates[i];
        const free = await this.estimateTravel(
          t.lat,
          t.lng,
          toLat,
          toLng,
          null,
        );
        if (free === null) unknown.push(i); // không có đường dù không có cảnh báo
        // free !== null → có đường khi không cảnh báo, mà bị chặn khi có → loại
      } catch {
        unknown.push(i);
      }
    }
    if (unknown.length > 0) {
      return {
        mode: 'straight_line',
        team: candidates[unknown[0]],
        travel: null,
        closerSkipped: unknown[0],
      };
    }
    return {
      mode: 'blocked',
      team: null,
      travel: null,
      closerSkipped: candidates.length,
    };
  }

  async findRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<RouteResult> {
    // Chặn TRƯỚC khi gọi ORS (đỡ tốn quota free tier) — chỉ tìm đường trong phạm vi tỉnh Lâm
    // Đồng, dùng lại ranh giới 123 xã/phường sẵn có trong PostGIS (wards.boundary), không cần
    // file/bảng riêng nào khác.
    const [fromInside, toInside] = await Promise.all([
      this.gisService.isPointInProvince(fromLat, fromLng),
      this.gisService.isPointInProvince(toLat, toLng),
    ]);
    if (!fromInside || !toInside) {
      throw new BadRequestException(
        'Điểm xuất phát hoặc điểm đến nằm ngoài phạm vi tỉnh Lâm Đồng — không tìm đường',
      );
    }

    const apiKey = this.config.get<string>('ORS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Dịch vụ tìm đường chưa được cấu hình (thiếu ORS_API_KEY)',
      );
    }

    // Cảnh báo/chặn đường do commander đánh dấu (sạt lở, cây đổ...) — buffer sẵn thành
    // MultiPolygon ở HazardsService, null khi không có cảnh báo active nào (bỏ hẳn field
    // avoid_polygons khỏi request thay vì gửi mảng rỗng — đỡ phải đoán ORS xử lý mảng rỗng
    // thế nào khi chưa verify được).
    const avoidPolygons = await this.hazardsService.findActiveAvoidPolygons();

    let res: { data: OrsResponse };
    try {
      res = await axios.post<OrsResponse>(
        `${ORS_BASE_URL}/${ORS_PROFILE}/geojson`,
        {
          // ORS nhận toạ độ theo chuẩn GeoJSON [lng, lat] — CÙNG chiều với coordinates trả
          // về (khác GraphHopper, nơi request "lat,lng" nhưng response "lng,lat").
          coordinates: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
          instructions: true,
          // Đã xác nhận hoạt động thật với API key thật: ORS trả hướng dẫn rẽ đúng tiếng Việt.
          language: 'vi',
          // Xin thêm 1 tuyến thay thế "gần gần" tuyến chính, để frontend vẽ nhạt hơn làm gợi
          // ý (theo yêu cầu Quang). Số liệu đã đo thật (không đoán, gọi thử endpoint thật):
          // - target_count PHẢI ≥ 2 — ORS lỗi 500 "Use normal algorithm..." nếu để 1.
          // - weight_factor: 2.0, share_factor: 0.9 → tuyến phụ dài hơn ~13% tuyến chính (khá
          //   gần); thử weight_factor thấp hơn (1.6) cho ra tuyến phụ CÁCH XA hơn (+38%) chứ
          //   không gần hơn — ORS không đảm bảo đơn điệu theo tham số, 2 số này là cặp đã đo
          //   thật cho kết quả "xa hơn 1 tí" đúng ý muốn, không phải suy luận lý thuyết.
          alternative_routes: {
            target_count: 2,
            share_factor: 0.9,
            weight_factor: 2.0,
          },
          // ⚠️ CHƯA xác nhận trực tiếp tham số này với ORS thật (khác base URL/coordinate
          // order/alternative_routes ở trên, đều đã gọi thử — api.heigit.org không truy cập
          // được từ môi trường lúc viết đoạn này, xem CLAUDE.md). options.avoid_polygons nhận
          // GeoJSON Polygon/MultiPolygon là hành vi ORS Directions API đã ổn định/tài liệu hoá
          // từ lâu, nhưng nếu ORS từ chối vì lý do bất kỳ (kể cả sai cú pháp), catch bên dưới
          // vẫn bắt được và trả 503 — frontend tự lùi về đường chim bay, không vỡ tính năng
          // chính. Cần verify lại với key thật ngay khi ORS truy cập được.
          ...(avoidPolygons
            ? { options: { avoid_polygons: avoidPolygons } }
            : {}),
        },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OpenRouteService error: ${message}`);
      throw new ServiceUnavailableException(
        'Không kết nối được dịch vụ tìm đường',
      );
    }

    const feature = res.data.features?.[0];
    if (!feature) {
      throw new ServiceUnavailableException(
        'Không tìm được tuyến đường phù hợp',
      );
    }

    // ⚠️ Bẫy toạ độ giống ST_MakePoint(lng, lat) ở PostGIS (CLAUDE.md Mục 15): geometry của
    // ORS là GeoJSON chuẩn [lng, lat], còn Leaflet (và mọi nơi khác trong app) dùng
    // [lat, lng] — đảo NGAY ở đây, đừng để frontend phải nhớ đảo lại.
    const geometry: [number, number][] = feature.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    );

    const steps = feature.properties.segments.flatMap((s) => s.steps);

    // features[1] (nếu có) là tuyến thay thế — chỉ lấy geometry để vẽ gợi ý, không cần
    // instructions riêng (frontend không dẫn đường theo tuyến này, chỉ hiển thị tham khảo).
    const altFeature = res.data.features?.[1];
    const alternateGeometry: [number, number][] | undefined =
      altFeature?.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      distance_meters: Math.round(feature.properties.summary.distance),
      duration_seconds: Math.round(feature.properties.summary.duration),
      geometry,
      instructions: steps.map((s) => {
        // way_points[0] là chỉ số vào geometry — geometry đã đảo [lat,lng] ở trên, dùng
        // thẳng luôn. Kẹp chỉ số trong khoảng hợp lệ phòng ORS trả lệch (chưa từng thấy
        // thật, nhưng rẻ để phòng hờ hơn là để frontend nhận lat/lng undefined).
        const idx = Math.min(Math.max(s.way_points[0], 0), geometry.length - 1);
        const [lat, lng] = geometry[idx];
        return {
          text: s.instruction,
          distance_meters: Math.round(s.distance),
          lat,
          lng,
        };
      }),
      ...(alternateGeometry && altFeature
        ? {
            alternate_geometry: alternateGeometry,
            alternate_distance_meters: Math.round(
              altFeature.properties.summary.distance,
            ),
          }
        : {}),
    };
  }
}

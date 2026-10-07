import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { User } from '../users/user.entity';
import { HazardReportsService } from './hazard-reports.service';
import type {
  CreateReportResult,
  HazardReportAdminRow,
  HazardReportRow,
  ReviewOutcome,
} from './hazard-reports.service';
import type { HazardResult } from '../hazards/hazards.service';
import { CreateHazardReportDto } from './dto/create-hazard-report.dto';
import {
  ApproveHazardReportDto,
  RejectHazardReportDto,
} from './dto/review-hazard-report.dto';
import { ListHazardReportsQueryDto } from './dto/list-hazard-reports-query.dto';
import { MAX_IMAGE_BYTES } from './image-validation';

interface AuthenticatedRequest extends Request {
  user: User;
}

// Không dùng @types/multer (chưa cài) — chỉ khai báo đúng phần dùng tới của file memoryStorage.
interface UploadedImage {
  buffer: Buffer;
  size: number;
}

interface Wrapped<T> {
  success: true;
  data: T;
  message: string;
}

@ApiTags('Hazard reports (community)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hazard-reports')
export class HazardReportsController {
  constructor(private readonly reportsService: HazardReportsService) {}

  // Mọi vai trò đã đăng nhập (người dân, tình nguyện viên/cứu hộ, chỉ huy) đều gửi được báo cáo.
  @Post()
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @ApiOperation({
    summary:
      'Gửi báo cáo cộng đồng về sạt lở/chặn đường (ẢNH BẮT BUỘC, chụp trực tiếp bằng camera) — vào trạng thái chờ duyệt, báo ngay cho quản trị viên; báo cáo trùng điểm tự gộp',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async create(
    @Body() dto: CreateHazardReportDto,
    @UploadedFile() file: UploadedImage | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<Wrapped<CreateReportResult>> {
    const data = await this.reportsService.create(
      {
        ...dto,
        image: file ? { buffer: file.buffer, size: file.size } : undefined,
      },
      req.user,
    );
    return {
      success: true,
      data,
      message: 'Đã gửi báo cáo, đang chờ quản trị viên xác minh',
    };
  }

  @Get('mine')
  @ApiOperation({ summary: 'Báo cáo do chính tôi gửi (kèm trạng thái duyệt)' })
  async mine(
    @Req() req: AuthenticatedRequest,
  ): Promise<Wrapped<HazardReportRow[]>> {
    return {
      success: true,
      data: await this.reportsService.findMine(req.user.id),
      message: 'OK',
    };
  }

  @Get()
  @Roles('commander')
  @ApiOperation({
    summary:
      'Hàng đợi kiểm duyệt (status=pending, mặc định) hoặc lịch sử đã duyệt/từ chối, có phân trang — chỉ commander',
  })
  async list(
    @Query() query: ListHazardReportsQueryDto,
  ): Promise<Wrapped<HazardReportAdminRow[]>> {
    return {
      success: true,
      data: await this.reportsService.findForModeration(
        query.status ?? 'pending',
        { limit: query.limit, offset: query.offset },
      ),
      message: 'OK',
    };
  }

  @Get(':id/image')
  @ApiOperation({
    summary: 'Ảnh minh chứng của báo cáo (chỉ commander hoặc người gửi)',
  })
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const img = await this.reportsService.getImage(id, req.user);
    res.set({
      'Content-Type': img.mime,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(img.data);
  }

  @Patch(':id/approve')
  @Roles('commander')
  @ApiOperation({
    summary:
      'Duyệt báo cáo → tạo cảnh báo thật hiện lên bản đồ chung (đỏ = chặn đường, vàng = cẩn trọng)',
  })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveHazardReportDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Wrapped<ReviewOutcome & { hazard: HazardResult }>> {
    return {
      success: true,
      data: await this.reportsService.approve(id, dto, req.user),
      message: 'Đã duyệt báo cáo và tạo cảnh báo',
    };
  }

  @Patch(':id/reject')
  @Roles('commander')
  @ApiOperation({
    summary: 'Từ chối báo cáo (không hiển thị lên bản đồ) — chỉ commander',
  })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectHazardReportDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Wrapped<ReviewOutcome>> {
    return {
      success: true,
      data: await this.reportsService.reject(id, dto.note, req.user),
      message: 'Đã từ chối báo cáo',
    };
  }
}

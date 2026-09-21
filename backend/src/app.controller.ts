import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

interface HealthData {
  status: 'ok';
  uptime: number;
  database: 'up' | 'down';
}

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // SkipThrottle BẮT BUỘC: APP_GUARD toàn cục giới hạn 100 req/phút cho mọi route, mà
  // Render.com ping health check rất dày lúc deploy (cộng UptimeRobot 5 phút/lần chống
  // sleep). Chạm ngưỡng → trả 429 → Render đọc là "không khoẻ" → restart lặp vô hạn.
  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check cho Render.com / UptimeRobot' })
  async getHealth(): Promise<{
    success: true;
    data: HealthData;
    message: string;
  }> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      // Cố ý KHÔNG để DB hỏng làm endpoint này fail: Render dùng health check để quyết
      // định restart, mà restart app không sửa được sự cố Supabase — trả lỗi ở đây chỉ
      // tạo vòng restart vô ích trong khi app vẫn phục vụ được phần không cần DB.
      database = 'down';
    }
    return {
      success: true,
      data: { status: 'ok', uptime: Math.floor(process.uptime()), database },
      message: 'OK',
    };
  }
}

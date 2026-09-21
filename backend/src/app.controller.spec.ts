import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  // TDD cho GET /api/health (CLAUDE.md Mục 15.5 — Render.com cần endpoint này để biết
  // server còn sống hay đã treo). Điểm KHÔNG hiển nhiên nằm ở test thứ 2: DB hỏng thì
  // health vẫn phải trả 200.
  describe('health', () => {
    it('DB truy vấn được → status ok, database "up"', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const res = await appController.getHealth();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(res).toMatchObject({
        success: true,
        data: { status: 'ok', database: 'up' },
      });
      expect(typeof res.data.uptime).toBe('number');
    });

    it('DB hỏng → VẪN trả về bình thường với database "down", không ném lỗi', async () => {
      // Cố ý không để lỗi DB làm health fail: Render dùng health check để quyết định
      // restart, mà restart app không sửa được sự cố Supabase — trả lỗi ở đây chỉ tạo
      // vòng restart vô ích trong khi app vẫn phục vụ được phần không cần DB.
      dataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await appController.getHealth();

      expect(res).toMatchObject({
        success: true,
        data: { status: 'ok', database: 'down' },
      });
    });
  });
});

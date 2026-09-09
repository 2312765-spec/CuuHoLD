import { ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './user.entity';
import type { RegisterDto } from '../auth/dto/register.dto';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: Partial<User>) => data as User),
      save: jest.fn((user: User) => Promise.resolve(user)),
    };
    service = new UsersService(usersRepo as unknown as Repository<User>);
    jest
      .mocked(bcrypt.hash)
      .mockReset()
      .mockResolvedValue('hashed' as never);
  });

  describe('create', () => {
    const dto: RegisterDto = {
      phone: '0901234567',
      name: 'Nguyen Van A',
      password: 'matkhau123',
    };

    it('luôn tạo tài khoản role victim, kể cả nếu payload cố gắng gửi kèm role khác', async () => {
      // RegisterDto không có field role — mô phỏng 1 payload "bypass" (VD: cast tay bỏ qua
      // ValidationPipe trong 1 lời gọi nội bộ nào đó) để khoá chặt bất biến "đăng ký công
      // khai chỉ tạo victim", không chỉ dựa vào type-level (xem CLAUDE.md Mục 15 — audit
      // leo thang đặc quyền qua register API).
      const dtoCoGangLeoThang = {
        ...dto,
        role: 'commander',
      } as unknown as RegisterDto;

      const user = await service.create(dtoCoGangLeoThang);

      expect(user.role).toBe('victim');
    });

    it('ném ConflictException khi số điện thoại đã tồn tại (kiểm tra trước)', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('ném ConflictException khi race-condition đụng unique constraint (code 23505)', async () => {
      usersRepo.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });
});

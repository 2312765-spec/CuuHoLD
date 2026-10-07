import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './user.entity';
import type { RegisterDto } from '../auth/dto/register.dto';
import type { AdminCreateUserDto } from './dto/admin-create-user.dto';

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

  describe('createByAdmin', () => {
    it('tạo được tài khoản với role tuỳ ý (endpoint gọi hàm này đã bị khoá commander-only ở controller)', async () => {
      const dto: AdminCreateUserDto = {
        phone: '0909999999',
        name: 'Rescuer Mới',
        password: 'matkhau123',
        role: 'rescuer',
        wardCode: '24823',
      };

      const user = await service.createByAdmin(dto);

      expect(user.role).toBe('rescuer');
      expect(user.wardCode).toBe('24823');
    });

    it('ném ConflictException khi số điện thoại đã tồn tại', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: 'existing' });
      const dto: AdminCreateUserDto = {
        phone: '0909999999',
        name: 'Rescuer Mới',
        password: 'matkhau123',
        role: 'rescuer',
      };

      await expect(service.createByAdmin(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateRole', () => {
    it('ném BadRequestException khi commander tự đổi role của chính mình', async () => {
      await expect(
        service.updateRole('user-1', 'commander', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi không tìm thấy người dùng', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateRole('user-2', 'commander', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('đổi role thành công khi target khác actor', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        id: 'user-2',
        role: 'victim',
      });

      const result = await service.updateRole('user-2', 'rescuer', 'user-1');

      expect(result.role).toBe('rescuer');
      expect(usersRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('ném BadRequestException khi commander tự khoá tài khoản của chính mình', async () => {
      await expect(
        service.updateStatus('user-1', false, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi không tìm thấy người dùng', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateStatus('user-2', false, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('khoá tài khoản thành công khi target khác actor', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        id: 'user-2',
        isActive: true,
      });

      const result = await service.updateStatus('user-2', false, 'user-1');

      expect(result.isActive).toBe(false);
      expect(usersRepo.save).toHaveBeenCalled();
    });
  });
});

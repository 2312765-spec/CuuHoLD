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

  // F-UI-01 — người dùng tự sửa hồ sơ. Chỉ được đổi TÊN; số điện thoại (tên đăng nhập) và
  // xã/phường (quyết định rescuer xem SOS xã nào) không có đường tự đổi.
  describe('updateMyName', () => {
    it('đổi tên (đã trim), không đụng phone/wardCode/role', async () => {
      const goc = {
        id: 'u1',
        phone: '0901234567',
        name: 'Ten Cu',
        wardCode: '24781',
        role: 'victim',
      } as User;
      usersRepo.findOne.mockResolvedValueOnce({ ...goc });

      const user = await service.updateMyName('u1', '  Ten Moi  ');

      expect(user.name).toBe('Ten Moi');
      expect(user.phone).toBe('0901234567');
      expect(user.wardCode).toBe('24781');
      expect(user.role).toBe('victim');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('ném NotFoundException khi tài khoản không còn tồn tại', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateMyName('u1', 'Ten Moi'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('changeMyPassword', () => {
    const user = { id: 'u1', passwordHash: 'hash-cu' } as User;

    beforeEach(() => {
      jest.mocked(bcrypt.compare).mockReset();
    });

    it('đúng mật khẩu hiện tại → băm mật khẩu mới với cost 12 và lưu', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...user });
      jest.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      jest.mocked(bcrypt.hash).mockResolvedValueOnce('hash-moi' as never);

      await service.changeMyPassword('u1', 'matkhau-cu', 'matkhau-moi');

      expect(bcrypt.compare).toHaveBeenCalledWith('matkhau-cu', 'hash-cu');
      expect(bcrypt.hash).toHaveBeenCalledWith('matkhau-moi', 12);
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', passwordHash: 'hash-moi' }),
      );
    });

    it('sai mật khẩu hiện tại → 400 (KHÔNG 401: frontend gặp 401 sẽ tự đăng xuất), không lưu', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...user });
      jest.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      await expect(
        service.changeMyPassword('u1', 'sai', 'matkhau-moi'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('mật khẩu mới trùng mật khẩu hiện tại → 400, không lưu', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...user });
      jest.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

      await expect(
        service.changeMyPassword('u1', 'giong-nhau', 'giong-nhau'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi tài khoản không còn tồn tại', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.changeMyPassword('u1', 'a', 'matkhau-moi'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

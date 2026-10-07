import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async create(dto: RegisterDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) throw new ConflictException('Số điện thoại đã được đăng ký');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      phone: dto.phone,
      name: dto.name,
      passwordHash,
      // Luôn 'victim' — RegisterDto không có field role (xem comment ở đó). Đăng ký công
      // khai không được phép tạo tài khoản rescuer/commander.
      role: 'victim',
      wardCode: dto.wardCode,
    });
    try {
      return await this.usersRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Số điện thoại đã được đăng ký');
      }
      throw err;
    }
  }

  async findByPhone(phone: string) {
    return this.usersRepo.findOne({ where: { phone } });
  }

  async findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  // Dùng cho GET /api/users (commander) — role optional để lọc theo vai trò trên UI.
  async findAll(role?: UserRole): Promise<User[]> {
    return this.usersRepo.find({
      where: role ? { role } : {},
      order: { createdAt: 'DESC' },
    });
  }

  // Khác create() (dùng cho /api/auth/register công khai, luôn ép role='victim') — hàm này
  // nhận role trực tiếp từ DTO vì caller (UsersController, chỉ commander gọi được qua
  // RolesGuard) đã được xác thực đủ quyền. Không phải lỗ hổng leo thang đặc quyền vì endpoint
  // KHÔNG công khai — xem comment trong admin-create-user.dto.ts.
  async createByAdmin(dto: AdminCreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) throw new ConflictException('Số điện thoại đã được đăng ký');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      phone: dto.phone,
      name: dto.name,
      passwordHash,
      role: dto.role,
      wardCode: dto.wardCode ?? null,
    });
    try {
      return await this.usersRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Số điện thoại đã được đăng ký');
      }
      throw err;
    }
  }

  // actorId = id của chính commander đang gọi — chặn tự đổi role của mình để tránh tự khoá
  // quyền commander của chính mình (không có tài khoản nào khác để mở lại). Không liên quan
  // gì tới lỗ hổng leo thang đặc quyền cũ (endpoint này vốn đã chỉ commander gọi được).
  async updateRole(id: string, role: UserRole, actorId: string): Promise<User> {
    if (id === actorId) {
      throw new BadRequestException('Không thể tự đổi vai trò của chính mình');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    user.role = role;
    return this.usersRepo.save(user);
  }

  // Cùng lý do chặn tự-thao-tác như updateRole() — tự khoá tài khoản mình sẽ không đăng nhập
  // lại được để tự mở khoá.
  async updateStatus(
    id: string,
    isActive: boolean,
    actorId: string,
  ): Promise<User> {
    if (id === actorId) {
      throw new BadRequestException(
        'Không thể tự khoá/mở khoá tài khoản của chính mình',
      );
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    user.isActive = isActive;
    return this.usersRepo.save(user);
  }
}

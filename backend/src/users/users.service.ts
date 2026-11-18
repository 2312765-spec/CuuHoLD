import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import * as bcrypt from 'bcrypt';

// Nhớ tạm tài khoản cho xác thực JWT (CLAUDE.md 15.30): trước đây MỌI request có JWT đọc lại
// tài khoản từ Supabase (~350 ms) chỉ để kiểm còn hoạt động — mỗi lần mở trang chậm gấp đôi.
const AUTH_CACHE_TTL_MS = 15_000;

@Injectable()
export class UsersService {
  private readonly authCache = new Map<
    string,
    { user: User; expiresAt: number }
  >();
  private readonly now: () => number;

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    // Đồng hồ tiêm được cho test; app Nest không cung cấp token này → Date.now.
    @Optional() @Inject('USERS_CLOCK') now?: () => number,
  ) {
    this.now = now ?? Date.now;
  }

  // Chỉ dùng cho JwtStrategy. Khoá/đổi vai trò/đổi tên/đổi mật khẩu đi qua service này đều
  // xoá bản nhớ tạm ngay (quenTaiKhoan). Thay đổi bằng SQL thẳng ở nơi khác (VD đếm huỷ trễ
  // `is_flagged` trong SosService.cancel) có thể trễ tối đa 15 giây trong req.user.
  async findByIdForAuth(id: string): Promise<User | null> {
    const t = this.now();
    const hit = this.authCache.get(id);
    if (hit && hit.expiresAt > t) return hit.user;
    const user = await this.findById(id);
    if (user)
      this.authCache.set(id, { user, expiresAt: t + AUTH_CACHE_TTL_MS });
    else this.authCache.delete(id);
    return user;
  }

  private quenTaiKhoan(id: string): void {
    this.authCache.delete(id);
  }

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

  // F-UI-01 — người dùng tự đổi TÊN của mình (DTO đã trim + kiểm độ dài). Không có tham số nào
  // khác: phone/wardCode/role không có đường tự đổi.
  async updateMyName(userId: string, name: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    user.name = name.trim();
    this.quenTaiKhoan(userId);
    return this.usersRepo.save(user);
  }

  // F-UI-01 — đổi mật khẩu, bắt buộc đúng mật khẩu hiện tại. Sai → 400, KHÔNG 401: interceptor
  // http.ts của frontend gặp 401 lúc đang đăng nhập sẽ tự đăng xuất người dùng.
  // ⚠️ JWT không trạng thái: token đã cấp trước khi đổi vẫn dùng được tới khi hết hạn (24h).
  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersRepo.save(user);
    this.quenTaiKhoan(userId);
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
    this.quenTaiKhoan(id);
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
    this.quenTaiKhoan(id);
    return this.usersRepo.save(user);
  }
}

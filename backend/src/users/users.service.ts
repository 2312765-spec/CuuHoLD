import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
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
      role: dto.role || 'victim',
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
}

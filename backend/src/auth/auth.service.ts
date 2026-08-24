import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	async register(dto: RegisterDto) {
		const user = await this.usersService.create(dto);
		return this.createAuthResponse(user);
	}

	async login(dto: LoginDto) {
		const user = await this.usersService.findByPhone(dto.phone);
		if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
			throw new UnauthorizedException('Sai thông tin đăng nhập');
		}
		if (!user.isActive) {
			throw new UnauthorizedException('Tài khoản đã bị khóa');
		}
		return this.createAuthResponse(user);
	}

	private async createAuthResponse(user: User) {
		const payload = {
			sub: user.id,
			phone: user.phone,
			role: user.role,
			districtCode: user.districtCode,
		};
		const secret = this.configService.getOrThrow<string>('JWT_SECRET');
		const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, { secret, expiresIn: '24h' }),
			this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: '7d' }),
		]);
		const { passwordHash, ...safeUser } = user;
		return {
			user: safeUser,
			accessToken,
			refreshToken,
			expiresIn: 86400,
		};
	}
}

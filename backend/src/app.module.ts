// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SosModule } from './sos/sos.module';
import { GisModule } from './gis/gis.module';
import { RescueTeamsModule } from './rescue-teams/rescue-teams.module';
import { envValidationSchema } from './config/env.validation';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // Rate limit chung cho mọi route (chặn DoS thô) — route nhạy cảm (login,
    // register, SOS) override số cụ thể bằng @Throttle() ngay tại controller,
    // xem AuthController và SosController.
    ThrottlerModule.forRoot([{ name: 'default', ttl: minutes(1), limit: 100 }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    UsersModule,

    AuthModule,

    SosModule,

    GisModule,

    RescueTeamsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}

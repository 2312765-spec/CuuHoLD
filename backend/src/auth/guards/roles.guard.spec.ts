import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { User, UserRole } from '../../users/user.entity';

function buildContext(user?: Pick<User, 'role'>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('cho phép truy cập khi route không yêu cầu role nào', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext({ role: 'victim' }))).toBe(true);
  });

  it('cho phép truy cập khi role của user nằm trong danh sách yêu cầu', () => {
    reflector.getAllAndOverride.mockReturnValue(['commander'] as UserRole[]);

    expect(guard.canActivate(buildContext({ role: 'commander' }))).toBe(true);
  });

  it('ném ForbiddenException khi role của user không đủ quyền', () => {
    reflector.getAllAndOverride.mockReturnValue(['commander'] as UserRole[]);

    expect(() => guard.canActivate(buildContext({ role: 'victim' }))).toThrow(
      ForbiddenException,
    );
  });

  it('ném ForbiddenException khi request không có user (chưa qua JwtAuthGuard)', () => {
    reflector.getAllAndOverride.mockReturnValue(['commander'] as UserRole[]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});

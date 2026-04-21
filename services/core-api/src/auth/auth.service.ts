import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AUTH_POLICY } from '../common/policies/auth.policy';
import { MESSAGE_POLICY } from '../common/policies/messages.policy';
import { generateEntityId } from '../common/utils/id.util';
import { AppConfig } from '../config/app-config.type';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
}

@Injectable()
export class AuthService {
  private readonly users = new Map<string, UserRecord>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  register(dto: RegisterDto): AuthResponseDto {
    const email = dto.email.toLowerCase();

    const existing = Array.from(this.users.values()).find((user) => user.email === email);
    if (existing) {
      return this.buildAuthResponse(existing.id, existing.email);
    }

    const id = generateEntityId(AUTH_POLICY.USER_ID_PREFIX);
    this.users.set(id, {
      id,
      email,
      fullName: dto.fullName,
      passwordHash: this.hashPassword(dto.password)
    });

    return this.buildAuthResponse(id, email);
  }

  login(dto: LoginDto): AuthResponseDto {
    const email = dto.email.toLowerCase();
    const user = Array.from(this.users.values()).find((record) => record.email === email);

    if (!user || user.passwordHash !== this.hashPassword(dto.password)) {
      throw new UnauthorizedException(MESSAGE_POLICY.AUTH_INVALID_CREDENTIALS);
    }

    return this.buildAuthResponse(user.id, user.email);
  }

  private buildAuthResponse(userId: string, email: string): AuthResponseDto {
    const tokenType = this.configService.get('auth.tokenType', { infer: true });
    const expiresIn = this.configService.get('auth.accessTokenTtlSeconds', { infer: true });

    return {
      userId,
      email,
      accessToken: this.buildMockAccessToken(userId, email),
      tokenType,
      expiresIn
    };
  }

  private hashPassword(raw: string): string {
    return createHash(AUTH_POLICY.HASH_ALGORITHM).update(raw).digest('hex');
  }

  private buildMockAccessToken(userId: string, email: string): string {
    const payload = `${userId}:${email}:${Date.now()}`;
    return Buffer.from(payload).toString('base64url');
  }
}
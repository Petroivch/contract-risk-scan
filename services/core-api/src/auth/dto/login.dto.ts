import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AUTH_POLICY } from '../../common/policies/auth.policy';

export class LoginDto {
  @ApiProperty({ example: 'legal.owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: AUTH_POLICY.PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(AUTH_POLICY.PASSWORD_MIN_LENGTH)
  password!: string;
}
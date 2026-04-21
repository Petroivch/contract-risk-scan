import { ApiProperty } from '@nestjs/swagger';
import { AuthTokenType } from '../../common/domain/auth-token-type.enum';
import { AUTH_POLICY } from '../../common/policies/auth.policy';

export class AuthResponseDto {
  @ApiProperty({ example: 'usr_a81f10d2' })
  userId!: string;

  @ApiProperty({ example: 'legal.owner@example.com' })
  email!: string;

  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken!: string;

  @ApiProperty({ enum: AuthTokenType, example: AuthTokenType.Bearer })
  tokenType!: AuthTokenType;

  @ApiProperty({ example: AUTH_POLICY.ACCESS_TOKEN_TTL_SECONDS_DEFAULT })
  expiresIn!: number;
}
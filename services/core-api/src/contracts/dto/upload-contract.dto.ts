import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DEFAULT_LOCALE, SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { CONTRACT_POLICY } from '../../common/policies/contracts.policy';

export class UploadContractDto {
  @ApiProperty({
    description: 'Role selected by user before upload; editable dropdown in mobile UI',
    example: 'contractor',
    minLength: CONTRACT_POLICY.ROLE_MIN_LENGTH,
    maxLength: CONTRACT_POLICY.ROLE_MAX_LENGTH
  })
  @IsString()
  @MinLength(CONTRACT_POLICY.ROLE_MIN_LENGTH)
  @MaxLength(CONTRACT_POLICY.ROLE_MAX_LENGTH)
  role!: string;

  @ApiPropertyOptional({
    description: 'Preferred locale for report generation. Invalid/missing value falls back to ru.',
    enum: SupportedLocale,
    default: DEFAULT_LOCALE,
    example: SupportedLocale.RU
  })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description: 'Alias for locale. Invalid/missing value falls back to ru.',
    enum: SupportedLocale,
    default: DEFAULT_LOCALE,
    example: SupportedLocale.RU,
    deprecated: true
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Optional counterparty role for stronger role-specific report interpretation',
    example: 'employer',
    maxLength: CONTRACT_POLICY.COUNTERPARTY_ROLE_MAX_LENGTH
  })
  @IsOptional()
  @IsString()
  @MaxLength(CONTRACT_POLICY.COUNTERPARTY_ROLE_MAX_LENGTH)
  counterpartyRole?: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable label in history list',
    example: 'Master Service Agreement April 2026',
    maxLength: CONTRACT_POLICY.CONTRACT_LABEL_MAX_LENGTH
  })
  @IsOptional()
  @IsString()
  @MaxLength(CONTRACT_POLICY.CONTRACT_LABEL_MAX_LENGTH)
  contractLabel?: string;
}
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { DEFAULT_LOCALE, SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { CONTRACT_POLICY } from '../../common/policies/contracts.policy';

export class AnalyzeContractDto {
  @ApiPropertyOptional({
    description: 'Rebuild report even if status is report_ready',
    example: false,
    default: false
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  forceReanalyze?: boolean = false;

  @ApiPropertyOptional({
    description: 'Override locale for this analysis run. Invalid/missing value falls back to ru.',
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
    description: 'Additional focus notes from UI (optional prompt for AI stage)',
    example: 'Pay special attention to liability and unilateral termination.',
    maxLength: CONTRACT_POLICY.FOCUS_NOTES_MAX_LENGTH
  })
  @IsOptional()
  @IsString()
  @MaxLength(CONTRACT_POLICY.FOCUS_NOTES_MAX_LENGTH)
  focusNotes?: string;
}
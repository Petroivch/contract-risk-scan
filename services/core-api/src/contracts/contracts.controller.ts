import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { DEFAULT_LOCALE, SupportedLocale } from '../common/i18n/supported-locale.enum';
import {
  buildContractStatusPath,
  CONTRACT_POLICY
} from '../common/policies/contracts.policy';
import { MESSAGE_POLICY } from '../common/policies/messages.policy';
import { AnalyzeContractDto } from './dto/analyze-contract.dto';
import { AnalyzeContractResponseDto } from './dto/analyze-contract-response.dto';
import { ContractsHistoryResponseDto } from './dto/contracts-history-response.dto';
import { ContractReportDto } from './dto/contract-report.dto';
import { ContractStatusResponseDto } from './dto/contract-status-response.dto';
import { UploadContractDto } from './dto/upload-contract.dto';
import { UploadContractResponseDto } from './dto/upload-contract-response.dto';
import { ContractsService } from './contracts.service';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor(CONTRACT_POLICY.FILE_FORM_FIELD_NAME))
  @ApiOperation({ summary: 'Upload a contract file for analysis' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role', CONTRACT_POLICY.FILE_FORM_FIELD_NAME],
      properties: {
        role: { type: 'string', example: 'contractor' },
        locale: {
          type: 'string',
          enum: Object.values(SupportedLocale),
          default: DEFAULT_LOCALE,
          example: DEFAULT_LOCALE
        },
        language: {
          type: 'string',
          enum: Object.values(SupportedLocale),
          default: DEFAULT_LOCALE,
          example: DEFAULT_LOCALE,
          deprecated: true
        },
        counterpartyRole: { type: 'string', example: 'employer' },
        contractLabel: { type: 'string', example: 'Service agreement 2026-04' },
        [CONTRACT_POLICY.FILE_FORM_FIELD_NAME]: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({ status: 201, type: UploadContractResponseDto })
  upload(
    @Body() dto: UploadContractDto,
    @UploadedFile() file?: Express.Multer.File
  ): UploadContractResponseDto {
    return this.contractsService.upload(dto, file);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user contracts history' })
  @ApiResponse({ status: 200, type: ContractsHistoryResponseDto })
  history(): ContractsHistoryResponseDto {
    const items = this.contractsService.history();
    return { items };
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Run risk analysis for uploaded contract' })
  @ApiParam({ name: 'id', required: true, example: 'ctr_k2v4m8x1' })
  @ApiResponse({ status: 200, type: AnalyzeContractResponseDto })
  analyze(
    @Param('id') contractId: string,
    @Body() dto: AnalyzeContractDto
  ): AnalyzeContractResponseDto {
    return this.contractsService.analyze(contractId, dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get analysis job status for contract' })
  @ApiParam({ name: 'id', required: true, example: 'ctr_k2v4m8x1' })
  @ApiResponse({ status: 200, type: ContractStatusResponseDto })
  status(@Param('id') contractId: string): ContractStatusResponseDto {
    return this.contractsService.status(contractId);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Get analysis report with risks and disputed clauses' })
  @ApiParam({ name: 'id', required: true, example: 'ctr_k2v4m8x1' })
  @ApiResponse({ status: 200, type: ContractReportDto })
  report(@Param('id') contractId: string): ContractReportDto {
    const report = this.contractsService.report(contractId);
    if (!report) {
      throw new ConflictException({
        message: MESSAGE_POLICY.REPORT_NOT_READY,
        statusEndpoint: buildContractStatusPath(contractId)
      });
    }

    return report;
  }
}
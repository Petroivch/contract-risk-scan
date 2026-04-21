import { SupportedLocale } from '../common/i18n/supported-locale.enum';
import { AnalysisJobState } from '../common/job-orchestration/job-orchestration.service';
import { ContractReportDto } from './dto/contract-report.dto';

export interface StoredContract {
  id: string;
  role: string;
  locale: SupportedLocale;
  counterpartyRole?: string;
  contractLabel?: string;
  focusNotes?: string;
  originalFileName: string;
  storedFileName: string;
  storedFilePath: string;
  fileMimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  updatedAt: string;
  analysisJobId?: string;
  report?: ContractReportDto;
  job: AnalysisJobState;
}

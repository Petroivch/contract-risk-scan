import type { AnalysisReport } from '../dto/api.dto';

export interface ReportDetailSectionParam {
  title: string;
  items: string[];
}

export type RootStackParamList = {
  UploadWithRole: undefined;
  Settings: undefined;
  AnalysisStatus: {
    analysisId: string;
    selectedRole: string;
  };
  Report: {
    analysisId: string;
    selectedRole?: string;
    initialReport?: AnalysisReport;
  };
  ReportItemDetail: {
    title: string;
    subtitle?: string;
    sections: ReportDetailSectionParam[];
  };
};




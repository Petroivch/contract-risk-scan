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
  };
  ReportItemDetail: {
    title: string;
    subtitle?: string;
    sections: ReportDetailSectionParam[];
  };
};

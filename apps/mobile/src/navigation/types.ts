export type RootStackParamList = {
  UploadWithRole: undefined;
  AnalysisStatus: {
    analysisId: string;
    selectedRole: string;
  };
  Report: {
    analysisId: string;
    selectedRole?: string;
  };
};

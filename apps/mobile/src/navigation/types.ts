export type RootStackParamList = {
  Auth: undefined;
  UploadWithRole: undefined;
  AnalysisStatus: {
    contractId: string;
    analysisId: string;
    selectedRole: string;
  };
  Report: {
    contractId: string;
    analysisId?: string;
    selectedRole?: string;
  };
  History: undefined;
  Settings: undefined;
};

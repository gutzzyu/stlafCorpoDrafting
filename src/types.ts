export interface Representative {
  name: string;
}

export interface PurposeRow {
  id: string;
  agency: string;
  rdo?: string;
  lgu?: string;
  text: string;
  suggestedPurpose: string;
}

export interface SPADetails {
  paperSize: 'legal' | 'a4' | 'letter';
  affiantName: string;
  nationality: string;
  civilStatus: string;
  address: string;
  representatives: string;
  idType: string;
  idNumber: string;
  purposes: PurposeRow[];
}

export interface SecClause {
  id: string;
  type: string; // RESOLVED, RESOLVED FURTHER, RESOLVED FINALLY
  text: string;
  tableData?: string[][];
}

export interface SecDetails {
  signatoryName: string;
  corpName: string;
  corpAddress: string;
  meetingType: string;
  meetingDate: string;
  headline: string;
  signatoryCapacity: string;
  signatoryAddress: string;
  idType: string;
  idNumber: string;
  clauses: SecClause[];
}

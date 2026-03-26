
export enum CaseStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  INVESTIGATING = 'INVESTIGATING',
  REFERRED = 'REFERRED',
  SUCCESSFUL = 'SUCCESSFUL',
  CLOSED = 'CLOSED',
  DISPUTED = 'DISPUTED'
}

export enum CorruptionType {
  BRIBERY = 'Bribery',
  PROCUREMENT_FRAUD = 'Procurement Fraud',
  ABUSE_OF_OFFICE = 'Abuse of Office',
  EMBEZZLEMENT = 'Embezzlement',
  NEPOTISM = 'Nepotism',
  OTHER = 'Other'
}

export enum UserRole {
  WHISTLEBLOWER = 'WHISTLEBLOWER',
  INVESTIGATOR = 'INVESTIGATOR',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  nexusKey: string;
  role: UserRole;
  isStealth?: boolean;
}

export interface CaseReport {
  id: string;
  case_id?: string;
  timestamp: string;
  type: string;
  description: string;
  location: string;
  institution: string;
  status: CaseStatus;
  riskScore: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reporterId: string;
  referenceCode: string;
  disputeReason?: string;
  closedAtStage?: string;
  lastUpdated?: string;
  blockchain_tx_hash?: string;
  blockchain_block_number?: number;
  attachments_count?: number;
  stage_evaluations_count?: number;
}

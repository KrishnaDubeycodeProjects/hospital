export type GridStatusType = '7days' | '15days' | '30days' | 'visited' | 'noData';

export interface FamilyUnit {
  id: string; // UUID
  sequentialNumber: number;
  houseNumber: number | string;
  headName: string;
  headDob?: string; // Date of birth for head of household
  primaryPhone: string; // Primary contact phone number
  villageName: string;
  visitIntervalDays: 7 | 15 | 30 | null;
  nextVisitDate: string;
  lastVisitedAt: string | null;
  ashaWorkerPhone: string;
  status: GridStatusType;
  totalMembers: number;
  hasPregnancy: boolean;
  hasDisease: boolean;
  hasChild: boolean;
  // Official Gram Survey Registry Fields (ग्राम सर्वे तालिका)
  toiletType?: 'Septic Tank' | 'Soak Pit' | 'Open Defecation' | 'Other';
  waterSource?: 'Handpump' | 'India Mark-II' | 'Well' | 'Tap Water' | 'Other';
  bplCard?: boolean;
  religion?: 'Hindu' | 'Muslim' | 'Sikh' | 'Christian' | 'Other';
  casteCategory?: 'SC' | 'ST' | 'OBC' | 'General' | 'Other';
  markedForHomeVisit?: boolean;
  updatedAt: string;
}

export interface FamilyMember {
  id: string; // UUID
  familyUnitId: string;
  name: string;
  initials: string;
  dob?: string; // Date of birth (DD/MM/YYYY)
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  relationship: string;
  phone?: string; // Member personal phone number (Optional 10-digit mobile)
  fatherOrHusbandName?: string;
  maritalStatus?: 'Unmarried' | 'Married' | 'Widow' | 'Widower';
  education?: 'Illiterate' | 'Primary' | 'Middle' | 'High School' | 'Graduate' | 'Other';
  abhaNumber?: string;
  isAbhaLinked: boolean;
  isPregnant: boolean;
  expectedDeliveryDate?: string;
  isHrp?: boolean; // High Risk Pregnancy (HRP)
  hasChronicCondition: boolean;
  chronicConditionType?: string;
  isNcdPatient?: boolean;
  ncdDiagnosis?: 'Diabetes' | 'Hypertension' | 'Oral Cancer' | 'Breast Cancer' | 'Cervical Cancer' | 'Other Cancer' | 'Other NCD';
  isChild?: boolean;
  lastSurveyDate?: string;
  followUpDueDate?: string;
  followUpReason?: string;
  updatedAt: string;
}

export interface ChildVaccinationRecord {
  id: string;
  familyUnitId: string;
  childMemberId: string;
  childName: string;
  fatherName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  ageMonths: number;
  phone?: string;
  mctsCode?: string;
  vaccines: Record<string, 'Given' | 'Due' | 'Not Given'>;
  updatedAt: string;
}

export interface AshaMeetingRecord {
  id: string;
  meetingDate: string;
  venue: string; // Destination / Location
  meetingType: 'VHSNC' | 'ASHA Cluster' | 'Sector Monthly' | 'VHND Planning' | 'Other';
  attendeesCount: number;
  materialsAvailable: string; // Items available during meeting
  discussionPoints: string;
  decisionsTaken: string;
  ashaWorkerPhone: string;
  createdAt: string;
}

export interface SurveyResponse {
  id: string; // UUID (offlineId)
  familyUnitId: string;
  familyMemberId: string;
  categoryCode: 'PREGNANCY' | 'DISEASE' | 'CHILD' | 'GENERAL';
  ashaWorkerPhone: string;
  answers: Record<string, any>;
  voiceNotes?: string;
  syncedToAnm: boolean;
  targetAnmPhone?: string;
  syncedAt?: string;
  createdAt: string;
}

export interface FollowUpTask {
  id: string; // UUID
  familyUnitId: string;
  familyMemberId: string;
  initials: string;
  name: string;
  taskType: string;
  dueDate: string;
  urgencyDays: string;
  isCompleted: boolean;
  completedAt?: string;
  ashaWorkerPhone: string;
}

export type OutboxAction =
  | 'CREATE_FAMILY'
  | 'UPDATE_FAMILY'
  | 'ADD_MEMBER'
  | 'SUBMIT_SURVEY'
  | 'COMPLETE_FOLLOWUP'
  | 'SAVE_MEETING'
  | 'UPDATE_CHILD_VACCINE'
  | 'SEND_TO_ANM';

export interface OutboxItem {
  id: string;
  action: OutboxAction;
  payload: any;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: string;
  syncedAt?: string;
  retryCount: number;
}

export type UserState =
  | 'NEW_USER'
  | 'ONBOARDING'
  | 'BUILDING_BASELINE'
  | 'BASELINE_READY'
  | 'IMPROVEMENT_ACTIVE'
  | 'WAITING_FOR_MORE_RECORDS'
  | 'RESULT_READY'
  | 'DATA_DELETION_PENDING';

export type TimeBucket = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
export type ObservationContext = 'NEAR_BOX' | 'ENTER_ROOM' | 'FIXED_SPOT';
export type ImprovementType =
  | 'SCOOP_MORE'
  | 'CHANGE_LITTER'
  | 'ADD_LITTER_BOX'
  | 'MOVE_LITTER_BOX'
  | 'IMPROVE_VENTILATION'
  | 'CLEAN_LITTER_BOX'
  | 'OTHER';
export type SpecialEventType =
  | 'JUST_SCOOPED'
  | 'JUST_CHANGED_LITTER'
  | 'JUST_CLEANED_BOX'
  | 'HUMID_WEATHER'
  | 'AWAY_LONG_TIME'
  | 'GUESTS'
  | 'OTHER';

export type BaselineProgress = {current: number; required: 3};

export type MeState = {
  state: UserState;
  needsOnboarding: boolean;
  baselineProgress: BaselineProgress;
  currentImprovement: Improvement | null;
};

export type OdorRecord = {
  id: string;
  odorLevel: number;
  recordedAt: string;
  localDate: string;
  timeBucket: TimeBucket;
  specialEventType: SpecialEventType | null;
  specialEventNote: string | null;
  improvementId: string | null;
};

export type Improvement = {
  id: string;
  type: ImprovementType;
  note: string | null;
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
  startedAt: string;
};

export type LatestResult = {
  code:
    | 'INSUFFICIENT_DATA'
    | 'BASELINE_READY'
    | 'POSSIBLE_IMPROVEMENT'
    | 'CLEAR_IMPROVEMENT'
    | 'NO_CLEAR_CHANGE'
    | 'POSSIBLE_WORSENING'
    | 'UNABLE_TO_DETERMINE';
  baselineCount: number;
  postCount: number;
  reasonCodes: string[];
  baselineMedian?: number;
  postMedian?: number;
  delta?: number;
  ruleVersion: string;
};

export type DeletionRequest = {
  id: string;
  status: 'PENDING' | 'CANCELLED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requestedAt: string;
  completedAt: string | null;
};

export type RecordResult = {
  duplicate: boolean;
  errorCode?: 'USER_NOT_ONBOARDED';
  recordId?: string;
  state?: UserState;
  baselineProgress?: BaselineProgress;
};

export type OnboardingInput = {
  lineUserIdHash: string;
  lineUserIdEncrypted: string;
  litterBoxCount: number;
  observationContext: ObservationContext;
  privacyVersion: string;
  locale: string;
  timezone: string;
};

export interface DataStore {
  completeOnboarding(input: OnboardingInput): Promise<MeState>;
  getState(lineUserIdHash: string): Promise<MeState>;
  registerWebhook(input: {webhookEventId: string; eventType: string; payloadSha256: string}): Promise<{duplicate: boolean}>;
  recordOdor(input: {
    lineUserIdHash: string;
    odorLevel: number;
    sourceEventId: string;
    recordedAt: string;
    localDate: string;
    timeBucket: TimeBucket;
    webhookEventId?: string;
    eventType?: string;
    payloadSha256?: string;
  }): Promise<RecordResult>;
  listRecords(lineUserIdHash: string, limit: number): Promise<OdorRecord[]>;
  updateSpecialEvent(input: {
    lineUserIdHash: string;
    recordId: string;
    specialEventType: SpecialEventType | null;
    specialEventNote: string | null;
  }): Promise<OdorRecord | null>;
  startImprovement(input: {lineUserIdHash: string; type: ImprovementType; note: string | null}): Promise<Improvement>;
  getCurrentImprovement(lineUserIdHash: string): Promise<Improvement | null>;
  getLatestResult(lineUserIdHash: string): Promise<LatestResult>;
  createDeletionRequest(lineUserIdHash: string): Promise<DeletionRequest>;
  getCurrentDeletionRequest(lineUserIdHash: string): Promise<DeletionRequest | null>;
}

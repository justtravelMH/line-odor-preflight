import {decide, median} from '@/domain/decision/engine';
import type {DataStore, DeletionRequest, Improvement, LatestResult, MeState, OdorRecord, OnboardingInput, RecordResult} from './types';

type MemoryUser = {
  id: string;
  state: MeState['state'];
  records: OdorRecord[];
  baselineIds: string[];
  improvement: Improvement | null;
  deletion: DeletionRequest | null;
};

export class MemoryStore implements DataStore {
  private users = new Map<string, MemoryUser>();
  private webhookIds = new Set<string>();
  private sourceIds = new Set<string>();

  reset() {
    this.users.clear();
    this.webhookIds.clear();
    this.sourceIds.clear();
  }

  async completeOnboarding(input: OnboardingInput) {
    const existing = this.users.get(input.lineUserIdHash);
    const user: MemoryUser = existing ?? {
      id: crypto.randomUUID(), state: 'BUILDING_BASELINE', records: [], baselineIds: [], improvement: null, deletion: null,
    };
    if (user.state === 'NEW_USER' || user.state === 'ONBOARDING') user.state = 'BUILDING_BASELINE';
    this.users.set(input.lineUserIdHash, user);
    return this.getState(input.lineUserIdHash);
  }

  async getState(lineUserIdHash: string): Promise<MeState> {
    const user = this.users.get(lineUserIdHash);
    if (!user) return {state: 'ONBOARDING', needsOnboarding: true, baselineProgress: {current: 0, required: 3}, currentImprovement: null};
    return {
      state: user.state,
      needsOnboarding: false,
      baselineProgress: {current: Math.min(user.records.filter((record) => !record.improvementId).length, 3), required: 3},
      currentImprovement: user.improvement,
    };
  }

  async registerWebhook(input: {webhookEventId: string}) {
    const duplicate = this.webhookIds.has(input.webhookEventId);
    this.webhookIds.add(input.webhookEventId);
    return {duplicate};
  }

  async recordOdor(input: Parameters<DataStore['recordOdor']>[0]): Promise<RecordResult> {
    if (input.webhookEventId && this.webhookIds.has(input.webhookEventId)) return {duplicate: true};
    if (input.webhookEventId) this.webhookIds.add(input.webhookEventId);
    if (this.sourceIds.has(input.sourceEventId)) return {duplicate: true};
    const user = this.users.get(input.lineUserIdHash);
    if (!user) return {duplicate: false, errorCode: 'USER_NOT_ONBOARDED'};
    this.sourceIds.add(input.sourceEventId);
    const record: OdorRecord = {
      id: crypto.randomUUID(), odorLevel: input.odorLevel, recordedAt: input.recordedAt,
      localDate: input.localDate, timeBucket: input.timeBucket, specialEventType: null,
      specialEventNote: null, improvementId: user.improvement?.id ?? null,
    };
    user.records.push(record);
    const baseline = user.records.filter((item) => !item.improvementId).slice(0, 3);
    if (!user.improvement && baseline.length >= 3) {
      user.baselineIds = baseline.map((item) => item.id);
      user.state = 'BASELINE_READY';
    } else if (user.improvement) {
      user.state = 'IMPROVEMENT_ACTIVE';
    } else {
      user.state = 'BUILDING_BASELINE';
    }
    return {duplicate: false, recordId: record.id, state: user.state, baselineProgress: {current: baseline.length, required: 3}};
  }

  async listRecords(lineUserIdHash: string, limit: number) {
    const records = this.users.get(lineUserIdHash)?.records ?? [];
    return [...records].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, limit).map((record) => ({...record}));
  }

  async updateSpecialEvent(input: Parameters<DataStore['updateSpecialEvent']>[0]) {
    const record = this.users.get(input.lineUserIdHash)?.records.find((item) => item.id === input.recordId);
    if (!record) return null;
    record.specialEventType = input.specialEventType;
    record.specialEventNote = input.specialEventNote;
    return {...record};
  }

  async startImprovement(input: Parameters<DataStore['startImprovement']>[0]) {
    const user = this.users.get(input.lineUserIdHash);
    if (!user || user.baselineIds.length < 3) throw new Error('BASELINE_NOT_READY');
    if (!user.improvement) {
      user.improvement = {id: crypto.randomUUID(), type: input.type, note: input.note, status: 'ACTIVE', startedAt: new Date().toISOString()};
    }
    user.state = 'IMPROVEMENT_ACTIVE';
    return {...user.improvement};
  }

  async getCurrentImprovement(lineUserIdHash: string) {
    const improvement = this.users.get(lineUserIdHash)?.improvement;
    return improvement ? {...improvement} : null;
  }

  async getLatestResult(lineUserIdHash: string): Promise<LatestResult> {
    const user = this.users.get(lineUserIdHash);
    if (!user) return {code: 'INSUFFICIENT_DATA', baselineCount: 0, postCount: 0, reasonCodes: ['NO_USER'], ruleVersion: 'LINE_ODOR_MVP_SPEC_V1'};
    const baseline = user.records.filter((record) => user.baselineIds.includes(record.id));
    const post = user.improvement ? user.records.filter((record) => record.improvementId === user.improvement?.id) : [];
    const dominantBucket = baseline.length
      ? [...new Set(baseline.map((record) => record.timeBucket))].sort((a, b) => baseline.filter((record) => record.timeBucket === b).length - baseline.filter((record) => record.timeBucket === a).length)[0]
      : undefined;
    const result = decide({
      baseline: baseline.map((record) => ({level: record.odorLevel, at: new Date(record.recordedAt), timeBucket: record.timeBucket, specialEvent: Boolean(record.specialEventType)})),
      post: post.map((record) => ({level: record.odorLevel, at: new Date(record.recordedAt), timeBucket: record.timeBucket, specialEvent: Boolean(record.specialEventType)})),
      hasActiveImprovement: Boolean(user.improvement), baselineDominantBucket: dominantBucket,
    });
    return {...result, baselineMedian: result.baselineMedian ?? median(baseline.map((record) => record.odorLevel))};
  }

  async createDeletionRequest(lineUserIdHash: string) {
    const user = this.users.get(lineUserIdHash);
    if (!user) throw new Error('USER_NOT_FOUND');
    user.deletion ??= {id: crypto.randomUUID(), status: 'PENDING', requestedAt: new Date().toISOString(), completedAt: null};
    user.state = 'DATA_DELETION_PENDING';
    return {...user.deletion};
  }

  async getCurrentDeletionRequest(lineUserIdHash: string) {
    const request = this.users.get(lineUserIdHash)?.deletion;
    return request ? {...request} : null;
  }
}

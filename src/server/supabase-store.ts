import {decide} from '@/domain/decision/engine';
import {db} from '@/lib/supabase';
import type {
  DataStore,
  DeletionRequest,
  Improvement,
  LatestResult,
  MeState,
  OdorRecord,
  OnboardingInput,
  RecordResult,
  SpecialEventType,
} from './types';

type DbUser = {id: string; state: MeState['state']};
type DbImprovement = {
  id: string;
  type: Improvement['type'];
  note: string | null;
  status: Improvement['status'];
  started_at: string;
};
type DbRecord = {
  id: string;
  odor_level: number;
  recorded_at: string;
  local_date: string;
  time_bucket: OdorRecord['timeBucket'];
  special_event_type: SpecialEventType | null;
  special_event_note: string | null;
  improvement_id: string | null;
};
type DbDeletion = {
  id: string;
  status: DeletionRequest['status'];
  requested_at: string;
  completed_at: string | null;
};

const filter = (value: string) => encodeURIComponent(value);

function mapImprovement(row: DbImprovement): Improvement {
  return {id: row.id, type: row.type, note: row.note, status: row.status, startedAt: row.started_at};
}

function mapRecord(row: DbRecord): OdorRecord {
  return {
    id: row.id,
    odorLevel: row.odor_level,
    recordedAt: row.recorded_at,
    localDate: row.local_date,
    timeBucket: row.time_bucket,
    specialEventType: row.special_event_type,
    specialEventNote: row.special_event_note,
    improvementId: row.improvement_id,
  };
}

function mapDeletion(row: DbDeletion): DeletionRequest {
  return {id: row.id, status: row.status, requestedAt: row.requested_at, completedAt: row.completed_at};
}

export class SupabaseStore implements DataStore {
  private async user(lineUserIdHash: string) {
    const rows = await db<DbUser[]>(
      `users?line_user_id_hash=eq.${filter(lineUserIdHash)}&deleted_at=is.null&select=id,state&limit=1`,
    );
    return rows[0] ?? null;
  }

  async completeOnboarding(input: OnboardingInput): Promise<MeState> {
    await db<{state: MeState['state']}>('rpc/complete_line_onboarding', {
      method: 'POST',
      body: JSON.stringify({
        p_line_user_id_hash: input.lineUserIdHash,
        p_line_user_id_encrypted: input.lineUserIdEncrypted,
        p_litter_box_count: input.litterBoxCount,
        p_observation_context: input.observationContext,
        p_privacy_version: input.privacyVersion,
        p_locale: input.locale,
        p_timezone: input.timezone,
      }),
    });
    return this.getState(input.lineUserIdHash);
  }

  async getState(lineUserIdHash: string): Promise<MeState> {
    const user = await this.user(lineUserIdHash);
    if (!user) {
      return {
        state: 'ONBOARDING',
        needsOnboarding: true,
        baselineProgress: {current: 0, required: 3},
        currentImprovement: null,
      };
    }
    const [baselineRows, improvement] = await Promise.all([
      db<Array<{id: string}>>(`odor_records?user_id=eq.${user.id}&improvement_id=is.null&select=id&limit=3`),
      this.getCurrentImprovement(lineUserIdHash),
    ]);
    return {
      state: user.state,
      needsOnboarding: false,
      baselineProgress: {current: Math.min(baselineRows.length, 3), required: 3},
      currentImprovement: improvement,
    };
  }

  async registerWebhook(input: {webhookEventId: string; eventType: string; payloadSha256: string}) {
    return db<{duplicate: boolean}>('rpc/register_line_webhook_event', {
      method: 'POST',
      body: JSON.stringify({
        p_webhook_event_id: input.webhookEventId,
        p_event_type: input.eventType,
        p_payload_sha256: input.payloadSha256,
      }),
    });
  }

  async recordOdor(input: Parameters<DataStore['recordOdor']>[0]): Promise<RecordResult> {
    return db<RecordResult>('rpc/record_line_odor', {
      method: 'POST',
      body: JSON.stringify({
        p_line_user_id_hash: input.lineUserIdHash,
        p_odor_level: input.odorLevel,
        p_source_event_id: input.sourceEventId,
        p_recorded_at: input.recordedAt,
        p_local_date: input.localDate,
        p_time_bucket: input.timeBucket,
        p_webhook_event_id: input.webhookEventId ?? null,
        p_event_type: input.eventType ?? 'record_odor',
        p_payload_sha256: input.payloadSha256 ?? null,
      }),
    });
  }

  async listRecords(lineUserIdHash: string, limit: number) {
    const user = await this.user(lineUserIdHash);
    if (!user) return [];
    const rows = await db<DbRecord[]>(
      `odor_records?user_id=eq.${user.id}&select=id,odor_level,recorded_at,local_date,time_bucket,special_event_type,special_event_note,improvement_id&order=recorded_at.desc&limit=${limit}`,
    );
    return rows.map(mapRecord);
  }

  async updateSpecialEvent(input: Parameters<DataStore['updateSpecialEvent']>[0]) {
    const user = await this.user(input.lineUserIdHash);
    if (!user) return null;
    const rows = await db<DbRecord[]>(
      `odor_records?id=eq.${filter(input.recordId)}&user_id=eq.${user.id}&select=id,odor_level,recorded_at,local_date,time_bucket,special_event_type,special_event_note,improvement_id`,
      {
        method: 'PATCH',
        body: JSON.stringify({special_event_type: input.specialEventType, special_event_note: input.specialEventNote}),
      },
    );
    return rows[0] ? mapRecord(rows[0]) : null;
  }

  async startImprovement(input: Parameters<DataStore['startImprovement']>[0]) {
    const row = await db<DbImprovement>('rpc/start_line_improvement', {
      method: 'POST',
      body: JSON.stringify({p_line_user_id_hash: input.lineUserIdHash, p_type: input.type, p_note: input.note}),
    });
    return mapImprovement(row);
  }

  async getCurrentImprovement(lineUserIdHash: string) {
    const user = await this.user(lineUserIdHash);
    if (!user) return null;
    const rows = await db<DbImprovement[]>(
      `improvements?user_id=eq.${user.id}&status=eq.ACTIVE&select=id,type,note,status,started_at&order=started_at.desc&limit=1`,
    );
    return rows[0] ? mapImprovement(rows[0]) : null;
  }

  async getLatestResult(lineUserIdHash: string): Promise<LatestResult> {
    const user = await this.user(lineUserIdHash);
    if (!user) {
      return {code: 'INSUFFICIENT_DATA', baselineCount: 0, postCount: 0, reasonCodes: ['NO_USER'], ruleVersion: 'LINE_ODOR_MVP_SPEC_V1'};
    }
    const snapshots = await db<Array<{record_ids: string[]; dominant_time_bucket: string | null}>>(
      `baseline_snapshots?user_id=eq.${user.id}&select=record_ids,dominant_time_bucket&order=created_at.desc&limit=1`,
    );
    const snapshot = snapshots[0];
    if (!snapshot) {
      const progress = await this.getState(lineUserIdHash);
      return {code: 'INSUFFICIENT_DATA', baselineCount: progress.baselineProgress.current, postCount: 0, reasonCodes: ['BASELINE_LT_3'], ruleVersion: 'LINE_ODOR_MVP_SPEC_V1'};
    }
    const improvement = await this.getCurrentImprovement(lineUserIdHash);
    const baselineRows = await db<DbRecord[]>(
      `odor_records?id=in.(${snapshot.record_ids.join(',')})&select=id,odor_level,recorded_at,local_date,time_bucket,special_event_type,special_event_note,improvement_id`,
    );
    const postRows = improvement
      ? await db<DbRecord[]>(
          `odor_records?improvement_id=eq.${improvement.id}&select=id,odor_level,recorded_at,local_date,time_bucket,special_event_type,special_event_note,improvement_id&order=recorded_at.asc&limit=10`,
        )
      : [];
    const decision = decide({
      baseline: baselineRows.map((row) => ({level: row.odor_level, at: new Date(row.recorded_at), timeBucket: row.time_bucket, specialEvent: Boolean(row.special_event_type)})),
      post: postRows.map((row) => ({level: row.odor_level, at: new Date(row.recorded_at), timeBucket: row.time_bucket, specialEvent: Boolean(row.special_event_type)})),
      hasActiveImprovement: Boolean(improvement),
      baselineDominantBucket: snapshot.dominant_time_bucket ?? undefined,
    });
    return decision;
  }

  async createDeletionRequest(lineUserIdHash: string) {
    const row = await db<DbDeletion>('rpc/request_line_data_deletion', {
      method: 'POST',
      body: JSON.stringify({p_line_user_id_hash: lineUserIdHash}),
    });
    return mapDeletion(row);
  }

  async getCurrentDeletionRequest(lineUserIdHash: string) {
    const user = await this.user(lineUserIdHash);
    if (!user) return null;
    const rows = await db<DbDeletion[]>(
      `deletion_requests?user_id=eq.${user.id}&select=id,status,requested_at,completed_at&order=requested_at.desc&limit=1`,
    );
    return rows[0] ? mapDeletion(rows[0]) : null;
  }
}

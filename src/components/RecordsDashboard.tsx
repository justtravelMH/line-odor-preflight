'use client';

import {useCallback, useEffect, useState} from 'react';
import type {Improvement, ImprovementType, OdorRecord} from '@/server/types';
import {SessionStatus, useLineSession} from './useLineSession';

const improvementLabels: Record<ImprovementType, string> = {
  SCOOP_MORE: '增加清理頻率', CHANGE_LITTER: '更換貓砂', ADD_LITTER_BOX: '增加砂盆',
  MOVE_LITTER_BOX: '移動砂盆', IMPROVE_VENTILATION: '改善通風', CLEAN_LITTER_BOX: '清洗砂盆', OTHER: '其他',
};

export default function RecordsDashboard() {
  const {status, me, message, login, refresh: refreshSession} = useLineSession();
  const [records, setRecords] = useState<OdorRecord[]>([]);
  const [improvement, setImprovement] = useState<Improvement | null>(null);
  const [level, setLevel] = useState(0);
  const [selectedImprovement, setSelectedImprovement] = useState<ImprovementType>('SCOOP_MORE');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [recordsResponse, improvementResponse] = await Promise.all([
      fetch('/api/v1/records?limit=20', {cache: 'no-store'}),
      fetch('/api/v1/improvements/current', {cache: 'no-store'}),
    ]);
    if (recordsResponse.ok) setRecords(((await recordsResponse.json()) as {records: OdorRecord[]}).records);
    if (improvementResponse.ok) setImprovement(((await improvementResponse.json()) as {improvement: Improvement | null}).improvement);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [load, status]);

  if (status !== 'authenticated') return <SessionStatus status={status} message={message} onLogin={login}/>;
  if (me?.needsOnboarding) return <div className="card"><h2>請先完成首次設定</h2><a className="button" href="/onboarding">前往設定</a></div>;

  async function addRecord() {
    setNotice('正在儲存…');
    const response = await fetch('/api/v1/records', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({odorLevel: level}),
    });
    if (!response.ok) return setNotice('紀錄沒有儲存成功。');
    const result = await response.json() as {baselineProgress?: {current: number}};
    setNotice(`已儲存，基準進度 ${result.baselineProgress?.current ?? 3}/3。`);
    await Promise.all([load(), refreshSession()]);
  }

  async function startImprovement() {
    setNotice('正在建立方案…');
    const response = await fetch('/api/v1/improvements', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({type: selectedImprovement, note: null}),
    });
    if (!response.ok) return setNotice('目前無法建立方案。');
    setNotice('改善方案已建立。');
    await Promise.all([load(), refreshSession()]);
  }

  return <>
    <div className="card" data-testid="current-plan"><span className="pill">目前方案</span>{improvement ? <><h2>{improvementLabels[improvement.type]}</h2><p className="muted">開始於 {new Date(improvement.startedAt).toLocaleDateString('zh-TW')}</p></> : <p className="muted">尚未建立改善方案</p>}</div>
    <div className="card"><h2>新增一筆紀錄</h2><div className="choices">{[0, 1, 2, 3].map((value) => <button key={value} aria-pressed={level === value} onClick={() => setLevel(value)}>{value} 級</button>)}</div><button className="primary" onClick={addRecord}>儲存紀錄</button></div>
    {me?.state === 'BASELINE_READY' && !improvement ? <div className="card"><h2>選擇一項改善</h2><label>改善方式<select value={selectedImprovement} onChange={(event) => setSelectedImprovement(event.target.value as ImprovementType)}>{Object.entries(improvementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="primary" onClick={startImprovement}>開始方案</button></div> : null}
    <p aria-live="polite">{notice}</p>
    {records.length === 0 ? <div className="card" data-testid="empty-records"><h2>還沒有紀錄</h2><p>從 LINE 點「記錄現在味道」開始，或在上方新增測試紀錄。</p></div> : <div className="card" data-testid="records-list"><h2>最近紀錄</h2>{records.map((record) => <div className="row" key={record.id}><span>{record.localDate}・{record.timeBucket}</span><strong>{record.odorLevel} 級</strong></div>)}</div>}
  </>;
}

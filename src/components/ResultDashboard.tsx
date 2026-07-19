'use client';

import {useEffect, useState} from 'react';
import type {LatestResult} from '@/server/types';
import {SessionStatus, useLineSession} from './useLineSession';

const cards = {
  INSUFFICIENT_DATA: ['資料還不夠', '再完成一些有效紀錄，我們才能比較。'],
  BASELINE_READY: ['日常基準已完成', '現在可以只選一項想改善的做法。'],
  POSSIBLE_IMPROVEMENT: ['看起來可能有改善', '目前紀錄比原本的日常基準低。'],
  CLEAR_IMPROVEMENT: ['目前看起來有明顯改善', '多次紀錄都比原本基準低。'],
  NO_CLEAR_CHANGE: ['目前沒有明顯變化', '兩段紀錄仍很接近。'],
  POSSIBLE_WORSENING: ['目前可能變得更明顯', '改善後紀錄高於原本基準。'],
  UNABLE_TO_DETERMINE: ['目前無法可靠判斷', '特殊事件、時段差異或間隔影響了可比性。'],
} as const;

export default function ResultDashboard() {
  const {status, message, login} = useLineSession();
  const [result, setResult] = useState<LatestResult | null>(null);
  useEffect(() => {
    if (status === 'authenticated') {
      void fetch('/api/v1/results/latest', {cache: 'no-store'}).then(async (response) => {
        if (response.ok) setResult(await response.json() as LatestResult);
      });
    }
  }, [status]);
  if (status !== 'authenticated') return <SessionStatus status={status} message={message} onLogin={login}/>;
  if (!result) return <div className="card" role="status">正在計算目前結果…</div>;
  const card = cards[result.code];
  return <><div className="card" data-testid="latest-result"><span className="pill">{result.code}</span><h2>{card[0]}</h2><p>{card[1]}</p><p className="muted">基準 {result.baselineCount} 筆・改善後 {result.postCount} 筆</p></div><p className="muted">這是依固定規則整理的生活紀錄趨勢，不代表醫療或科學結論。</p></>;
}

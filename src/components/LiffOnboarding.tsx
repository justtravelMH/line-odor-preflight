'use client';

import {useState} from 'react';
import {SessionStatus, useLineSession} from './useLineSession';

export default function LiffOnboarding() {
  const {status: sessionStatus, me, message: sessionMessage, login, refresh} = useLineSession();
  const [boxes, setBoxes] = useState(1);
  const [context, setContext] = useState('NEAR_BOX');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');

  if (sessionStatus !== 'authenticated') {
    return <SessionStatus status={sessionStatus} message={sessionMessage} onLogin={login}/>;
  }
  if (me && !me.needsOnboarding) {
    return <div className="card" data-testid="onboarding-complete"><h2>首次設定已完成</h2><p>目前基準進度：{me.baselineProgress.current}/3。可以回到 LINE 開始記錄。</p></div>;
  }

  async function submit() {
    if (!consent) return setStatus('請先閱讀並同意隱私說明。');
    setStatus('正在儲存…');
    const response = await fetch('/api/v1/onboarding', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({litterBoxCount: boxes, observationContext: context, privacyVersion: '2026-07-19'}),
    });
    if (response.status === 401) return setStatus('登入已過期，請重新登入。');
    if (!response.ok) return setStatus('這次沒有儲存成功，請稍後重試。');
    setStatus('設定完成，可以回 LINE 開始記錄。');
    await refresh();
  }

  return <>
    <div className="card"><h2>砂盆有幾個？</h2><div className="choices">{[1, 2, 3, 4].map((number) => <button key={number} aria-pressed={boxes === number} onClick={() => setBoxes(number)}>{number === 4 ? '4+' : number}</button>)}</div></div>
    <div className="card"><h2>平常在哪裡判斷？</h2><div className="choices">{[['NEAR_BOX', '靠近砂盆'], ['ENTER_ROOM', '進入房間'], ['FIXED_SPOT', '家中固定位置']].map(([value, label]) => <button key={value} aria-pressed={context === value} onClick={() => setContext(value)}>{label}</button>)}</div></div>
    <label className="card"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>我同意保存主動提交的紀錄，以固定規則產生趨勢。這不是醫療或科學檢測。</label>
    <button className="primary" onClick={submit}>完成設定</button><p aria-live="polite">{status}</p>
  </>;
}

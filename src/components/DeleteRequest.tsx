'use client';

import {useEffect, useState} from 'react';
import type {DeletionRequest as DeletionRequestType} from '@/server/types';
import {SessionStatus, useLineSession} from './useLineSession';

export default function DeleteRequest() {
  const {status, message, login} = useLineSession();
  const [confirm, setConfirm] = useState(false);
  const [request, setRequest] = useState<DeletionRequestType | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (status === 'authenticated') {
      void fetch('/api/v1/privacy/deletion-requests/current', {cache: 'no-store'}).then(async (response) => {
        if (response.ok) setRequest(((await response.json()) as {request: DeletionRequestType | null}).request);
      });
    }
  }, [status]);
  if (status !== 'authenticated') return <SessionStatus status={status} message={message} onLogin={login}/>;

  async function send() {
    if (!confirm) return;
    const response = await fetch('/api/v1/privacy/deletion-requests', {method: 'POST'});
    if (!response.ok) return setNotice('目前無法送出，請稍後重試。');
    const created = await response.json() as DeletionRequestType;
    setRequest(created);
    setNotice('刪除申請已送出。');
  }

  return <div className="card"><h2>申請刪除</h2>{request ? <p data-testid="deletion-status">目前申請狀態：{request.status}</p> : <><p>刪除後無法復原，且目前觀察中的方案與結果會一起移除。</p><label><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)}/>我了解這項操作無法復原</label><button className="danger" disabled={!confirm} onClick={send}>送出刪除申請</button></>}<p aria-live="polite">{notice}</p></div>;
}

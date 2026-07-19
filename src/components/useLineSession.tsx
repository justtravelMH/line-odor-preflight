'use client';

import {useCallback, useEffect, useState} from 'react';
import type {MeState} from '@/server/types';

type Status = 'checking' | 'authenticated' | 'unauthorized' | 'error';

export function useLineSession() {
  const [status, setStatus] = useState<Status>('checking');
  const [me, setMe] = useState<MeState | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setStatus('checking');
    const response = await fetch('/api/v1/me/state', {cache: 'no-store'});
    if (response.status === 401) {
      setMe(null);
      setStatus('unauthorized');
      return null;
    }
    if (!response.ok) {
      setStatus('error');
      setMessage('目前無法讀取資料，請稍後重試。');
      return null;
    }
    const state = (await response.json()) as MeState;
    setMe(state);
    setStatus('authenticated');
    return state;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async () => {
    try {
      setMessage('正在連接 LINE…');
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error('LIFF_NOT_CONFIGURED');
      const {default: liff} = await import('@line/liff');
      await liff.init({liffId});
      if (!liff.isLoggedIn()) {
        liff.login({redirectUri: window.location.href});
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) throw new Error('LINE_ID_TOKEN_MISSING');
      const response = await fetch('/api/v1/auth/line/session', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({idToken}),
      });
      if (!response.ok) throw new Error('LINE_SESSION_REJECTED');
      setMessage('');
      await refresh();
    } catch {
      setStatus('unauthorized');
      setMessage('LINE 登入沒有完成，請重新嘗試。');
    }
  }, [refresh]);

  return {status, me, message, refresh, login};
}

export function SessionStatus({status, message, onLogin}: {status: Status; message: string; onLogin: () => void}) {
  if (status === 'checking') return <div className="card" role="status">正在讀取資料…</div>;
  if (status === 'unauthorized') {
    return <div className="card"><h2>需要 LINE 登入</h2><p>為了只顯示你的紀錄，請重新登入 LINE。</p><button className="primary" onClick={onLogin}>重新登入 LINE</button><p aria-live="polite">{message}</p></div>;
  }
  if (status === 'error') return <div className="card" role="alert">{message}</div>;
  return null;
}

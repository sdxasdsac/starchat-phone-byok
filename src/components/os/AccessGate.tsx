'use client';

import { useState, type FormEvent } from 'react';
import { mdiLockOutline } from '@mdi/js';
import { tryUnlock } from '@/lib/access';
import { Mdi } from './ui';

export function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!value.trim()) {
      setError('请先输入密钥');
      return;
    }
    setBusy(true);
    const result = await tryUnlock(value);
    setBusy(false);
    if (result.ok) {
      onUnlock();
      return;
    }
    setError(
      result.reason === 'used'
        ? '这个密钥已经被其他设备激活过'
        : result.reason === 'network'
          ? '密钥服务暂时不可用，请联网后重试'
          : '密钥不正确，请核对后再试',
    );
  };

  return (
    <div className="access-gate">
      <form className="access-card" onSubmit={submit}>
        <div className="access-icon">
          <Mdi path={mdiLockOutline} size={30} />
        </div>
        <h1>小手机</h1>
        <p className="access-sub">请输入你的专属密钥（一人一个）</p>
        <input
          className="access-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          placeholder="输入密钥"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error ? <p className="access-error">{error}</p> : null}
        <button type="submit" className="access-btn" disabled={busy}>
          {busy ? '验证中…' : '进入小手机'}
        </button>
        <p className="access-hint">验证一次后会记住，以后打开不用再输。没有密钥请联系站长。</p>
      </form>
    </div>
  );
}

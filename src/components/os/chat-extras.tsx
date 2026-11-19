'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mdiPhone, mdiPhoneHangup, mdiVideo, mdiMapMarker, mdiGiftOutline, mdiCheckCircle } from '@mdi/js';
import type { ChatCard } from '@/lib/chat-cards';
import { readMedia } from '@/lib/media-db';
import type { Persona } from '@/lib/types';
import { Avatar, Mdi } from './ui';

function timeText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 语音条：点一下播放（音频存 IndexedDB） */
export function VoiceBubble({ audioId, duration, mine }: { audioId: string; duration: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback(async () => {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    const dataUrl = await readMedia(audioId);
    if (!dataUrl) return;
    const audio = new Audio(dataUrl);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  }, [audioId, playing]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const bars = Math.min(10, Math.max(4, Math.round(duration / 2) + 2));
  return (
    <button
      type="button"
      className={`voice-bubble${mine ? ' mine' : ''}${playing ? ' playing' : ''}`}
      onClick={() => void toggle()}
      aria-label="播放语音"
    >
      <span className="voice-wave">
        {Array.from({ length: bars }).map((_, index) => (
          <i key={index} style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </span>
      <span className="voice-duration">{Math.max(1, Math.round(duration))}″</span>
    </button>
  );
}

/** 红包 / 转账 / 礼物 / 位置 卡片 */
export function CardBubble({ card, mine }: { card: ChatCard; mine: boolean }) {
  const { kind, payload } = card;
  if (kind === 'redpacket') {
    return (
      <div className={`card-bubble redpacket${mine ? ' mine' : ''}`}>
        <div className="rp-top">
          <span className="rp-icon">🧧</span>
          <div>
            <div className="rp-note">{payload.note}</div>
            <div className="rp-hint">领取红包</div>
          </div>
        </div>
        <div className="rp-bottom">¥ {payload.amount}</div>
      </div>
    );
  }
  if (kind === 'transfer') {
    return (
      <div className={`card-bubble transfer${mine ? ' mine' : ''}`}>
        <div className="transfer-main">
          <span className="transfer-icon">¥</span>
          <div>
            <div className="transfer-amount">{payload.amount}</div>
            <div className="transfer-note">{payload.note || '转账'}</div>
          </div>
          <Mdi path={mdiCheckCircle} size={18} />
        </div>
        <div className="transfer-bottom">已收款</div>
      </div>
    );
  }
  if (kind === 'gift') {
    return (
      <div className={`card-bubble gift${mine ? ' mine' : ''}`}>
        <Mdi path={mdiGiftOutline} size={22} />
        <div>
          <div className="gift-name">{payload.name}</div>
          <div className="gift-price">¥ {payload.amount}</div>
        </div>
      </div>
    );
  }
  if (kind === 'location') {
    return (
      <div className={`card-bubble location${mine ? ' mine' : ''}`}>
        <div className="loc-map" aria-hidden>
          <span className="loc-pin">
            <Mdi path={mdiMapMarker} size={22} />
          </span>
        </div>
        <div className="loc-text">
          <div className="loc-name">{payload.name}</div>
          <div className="loc-address">{payload.address}</div>
        </div>
      </div>
    );
  }
  return null;
}

type CallState = 'calling' | 'incoming' | 'active' | 'ended';

/** 语音 / 视频通话浮层：呼叫、来电、通话中、结束 */
export function CallOverlay({
  persona,
  media,
  incoming,
  onClose,
}: {
  persona: Persona;
  media: 'voice' | 'video';
  incoming: boolean;
  onClose: (result: { seconds: number; missed: boolean }) => void;
}) {
  const [state, setState] = useState<CallState>(incoming ? 'incoming' : 'calling');
  const [seconds, setSeconds] = useState(0);
  const stateRef = useRef<CallState>(state);
  stateRef.current = state;

  // 拨出 2.6 秒后自动接通（模拟对方接听）
  useEffect(() => {
    if (state !== 'calling') return;
    const t = window.setTimeout(() => setState('active'), 2600);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== 'active' && state !== 'incoming') return;
    const t = window.setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);

  // 来电 20 秒没人接 → 未接来电
  useEffect(() => {
    if (state !== 'incoming') return;
    const t = window.setTimeout(() => {
      setState('ended');
      window.setTimeout(() => onClose({ seconds: 0, missed: true }), 600);
    }, 20000);
    return () => window.clearTimeout(t);
  }, [state, onClose]);

  const hangup = () => {
    const secs = state === 'active' ? seconds : 0;
    setState('ended');
    window.setTimeout(() => onClose({ seconds: secs, missed: state === 'incoming' }), 500);
  };

  const accept = () => {
    setState('active');
    setSeconds(0);
  };

  return (
    <div className={`call-overlay ${media} state-${state}`}>
      <div className="call-bg" />
      <div className="call-avatar">
        <Avatar persona={persona} size={92} />
      </div>
      <div className="call-name">{persona.name}</div>
      <div className="call-status">
        {state === 'calling' ? `正在呼叫…` : null}
        {state === 'incoming' ? `${media === 'video' ? '视频' : '语音'}通话邀请…` : null}
        {state === 'active' ? timeText(seconds) : null}
        {state === 'ended' ? '通话已结束' : null}
      </div>
      <div className="call-actions">
        {state === 'incoming' ? (
          <>
            <button type="button" className="call-btn hangup" onClick={hangup} aria-label="拒绝">
              <Mdi path={mdiPhoneHangup} size={26} />
            </button>
            <button type="button" className="call-btn accept" onClick={accept} aria-label="接听">
              <Mdi path={media === 'video' ? mdiVideo : mdiPhone} size={26} />
            </button>
          </>
        ) : (
          <button type="button" className="call-btn hangup" onClick={hangup} aria-label="挂断">
            <Mdi path={mdiPhoneHangup} size={26} />
          </button>
        )}
      </div>
    </div>
  );
}

export { timeText };

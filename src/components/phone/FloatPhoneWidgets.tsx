'use client';

// 移植自 ai-virtual-phone-main/components/widgets/widget-renderer.tsx（clock / calendar 两种 2×2 组件）
// DOM 结构与 class 名与源项目一致，样式见 styles/float-phone/widgets.css。
import { useEffect, useRef, useState } from 'react';
import type { WidgetInstance } from '@/components/phone/float-widgets';
import { WIDGET_SIZE_CELLS } from '@/components/phone/float-widgets';

/** 首帧固定值，避免服务端与客户端时间不一致导致 hydration mismatch */
const SSR_DATE = new Date(2024, 0, 1, 0, 0);

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function CalendarWidget() {
  const mounted = useMounted();
  const now = mounted ? new Date() : SSR_DATE;
  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const day = now.getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayEng = weekdays[now.getDay()];

  return (
    <div className="wg-calendar">
      <div className="wg-calendar-header">
        <div className="wg-calendar-header-glass">
          <span className="wg-calendar-ym">{year}年{monthNum}月</span>
        </div>
      </div>
      <div className="wg-calendar-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <span key={d} className="wg-cal-head">{d}</span>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span key={i + 1} className={i + 1 === day ? 'wg-cal-day wg-cal-today' : 'wg-cal-day'}>
            {i + 1}
          </span>
        ))}
      </div>
      <span className="wg-calendar-eng">today is {weekdayEng}</span>
    </div>
  );
}

function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const t = time ?? SSR_DATE;
  const h = String(t.getHours()).padStart(2, '0');
  const m = String(t.getMinutes()).padStart(2, '0');
  const month = t.getMonth() + 1;
  const day = t.getDate();
  const weekdaysCn = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = `周${weekdaysCn[t.getDay()]}`;

  return (
    <div className="wg-clock">
      <div className="wg-clock-top">
        <span className="wg-clock-date">{month}月{day}日</span>
        <span className="wg-clock-weekday">{weekday}</span>
      </div>
      <div className="wg-clock-time-row">
        <span className="wg-clock-h">{h}</span>
        <span className="wg-clock-colon">:</span>
        <span className="wg-clock-m">{m}</span>
      </div>
      <div className="wg-clock-bottom">
        <div className="wg-clock-line" />
        <span className="wg-clock-eng">have a nice day</span>
        <div className="wg-clock-line" />
      </div>
    </div>
  );
}

/** 极简数字大时钟 (2x4) */
function LargeTimeWidget() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const t = time ?? SSR_DATE;
  const h = String(t.getHours()).padStart(2, '0');
  const m = String(t.getMinutes()).padStart(2, '0');
  const month = t.getMonth() + 1;
  const day = t.getDate();
  const weekdaysCn = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = `周${weekdaysCn[t.getDay()]}`;

  return (
    <div className="wg-large-time">
      <div className="wg-lt-date">
        {month}月{day}日 {weekday}
      </div>
      <div className="wg-lt-time">
        {h}:{m}
      </div>
    </div>
  );
}

const MOOD_PILL_DEFAULT = '.*I ENJOY LIFE NOW ☁ 63°.*';

/** 悬浮心情气泡 (1x4)；源项目的点击编辑弹窗依赖未移植的 ContentDialog */
function MoodPillWidget({ config }: { config?: Record<string, unknown> }) {
  const text = typeof config?.text === 'string' ? config.text : MOOD_PILL_DEFAULT;
  return (
    <div className="wg-mood-pill">
      <div className="wg-mood-bubble">
        <span>{text}</span>
      </div>
    </div>
  );
}

const LOVE_NOTES_DEFAULT = [
  '你是我最美的相遇',
  '每天都想和你在一起',
  '你的笑容是我的全世界',
  '想和你走遍每一个角落',
  '有你的日子都是晴天',
  '你是我写不完的温柔',
];

/** 情话便签 (2x2)；源项目的点击编辑弹窗依赖未移植的 ContentDialog */
function LoveNoteWidget({ config }: { config?: Record<string, unknown> }) {
  const mounted = useMounted();
  const [noteIdx, setNoteIdx] = useState(0);
  useEffect(() => {
    if (mounted) setNoteIdx(Math.floor(Math.random() * LOVE_NOTES_DEFAULT.length));
  }, [mounted]);
  const customText = typeof config?.text === 'string' ? config.text : '';
  const noteText = customText || LOVE_NOTES_DEFAULT[noteIdx];
  const now = mounted ? new Date() : SSR_DATE;

  return (
    <div className="wg-lovenote">
      <div className="wg-lovenote-top">
        <span className="wg-lovenote-eng">love note</span>
        <span className="wg-lovenote-date">{now.getMonth() + 1}.{now.getDate()}</span>
      </div>
      <div className="wg-lovenote-body" role="button" tabIndex={0}>
        <span className="wg-lovenote-quote">“</span>
        <span className="wg-lovenote-text">{noteText}</span>
        <span className="wg-lovenote-quote">”</span>
      </div>
      <div className="wg-lovenote-footer">
        <div className="wg-lovenote-line" />
        <svg viewBox="0 0 20 20" width="14" height="14">
          <path
            d="M10 18s-7-5-7-10c0-3 2-5 4-5 1 0 2 .5 3 1.5 1-1 2-1.5 3-1.5 2 0 4 2 4 5 0 5-7 10-7 10z"
            fill="currentColor"
          />
        </svg>
        <div className="wg-lovenote-line" />
      </div>
    </div>
  );
}

/** 照片相框 (2x2)：点击选择本地图片，转 dataURL 写入组件配置 */
function PhotoWidget({
  config,
  widgetId,
  onConfigChange,
}: {
  config?: Record<string, unknown>;
  widgetId: string;
  onConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
}) {
  const imageDataUrl = typeof config?.imageDataUrl === 'string' ? config.imageDataUrl : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="wg-photo"
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            onConfigChange?.(widgetId, { ...config, imageDataUrl: String(reader.result) });
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
      {imageDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageDataUrl} alt="" className="wg-photo-img" />
      ) : (
        <div className="wg-photo-placeholder">
          <span className="wg-upload-hint">点击换图</span>
        </div>
      )}
      <div className="wg-photo-deco">
        <svg viewBox="0 0 20 20" width="14" height="14">
          <path
            d="M10 18s-7-5-7-10c0-3 2-5 4-5 1 0 2 .5 3 1.5 1-1 2-1.5 3-1.5 2 0 4 2 4 5 0 5-7 10-7 10z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="wg-photo-corner wg-photo-corner-tl" />
      <div className="wg-photo-corner wg-photo-corner-br" />
    </div>
  );
}

export function FloatPhoneWidget({
  widget,
  onConfigChange,
}: {
  widget: WidgetInstance;
  onConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
}) {
  const [rows, cols] = WIDGET_SIZE_CELLS[widget.size];
  return (
    <div
      className="widget-wrap"
      data-flip-id={`widget:${widget.id}`}
      style={{ gridRow: `${widget.row} / span ${rows}`, gridColumn: `${widget.col} / span ${cols}` }}
    >
      <div className={`widget-glass widget-${widget.size}`}>
        {widget.type === 'clock' ? (
          <ClockWidget />
        ) : widget.type === 'calendar' ? (
          <CalendarWidget />
        ) : widget.type === 'largeTime' ? (
          <LargeTimeWidget />
        ) : widget.type === 'moodPill' ? (
          <MoodPillWidget config={widget.config} />
        ) : widget.type === 'photo' ? (
          <PhotoWidget config={widget.config} widgetId={widget.id} onConfigChange={onConfigChange} />
        ) : (
          <LoveNoteWidget config={widget.config} />
        )}
      </div>
    </div>
  );
}

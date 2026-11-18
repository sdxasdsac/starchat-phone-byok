'use client';

import {
  mdiAlertCircleOutline,
  mdiArrowLeft,
  mdiCheck,
  mdiClose,
  mdiCommentOutline,
  mdiDownload,
  mdiHeart,
  mdiHeartOutline,
  mdiImagePlus,
  mdiLoading,
  mdiMicrophone,
  mdiPencilOutline,
  mdiPlus,
  mdiRefresh,
  mdiSend,
  mdiStarFourPoints,
  mdiTrashCanOutline,
  mdiUpload,
  mdiVolumeHigh,
} from '@mdi/js';
import type { CSSProperties, ReactNode } from 'react';
import type { Persona } from '@/lib/types';

export function Mdi({ path, size = 20, className }: { path: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <Mdi path={mdiLoading} size={size} className="spin" />;
}

export function Avatar({
  persona,
  name,
  avatar,
  size = 40,
  className = '',
}: {
  persona?: Persona;
  name?: string;
  avatar?: string;
  size?: number;
  className?: string;
}) {
  const src = avatar ?? persona?.avatar;
  const label = name ?? persona?.name ?? '?';
  const style: CSSProperties = { width: size, height: size, fontSize: Math.max(14, size * 0.44) };
  const isImage = Boolean(src && /^(data:|https?:|blob:)/.test(src));
  return (
    <span className={`avatar ${className}`} style={style} aria-label={label}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} />
      ) : (
        <span>{src || label.slice(0, 1)}</span>
      )}
    </span>
  );
}

export function Screen({
  title,
  subtitle,
  onBack,
  right,
  children,
  className = '',
  bodyClassName = '',
  hideHeader = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
}) {
  return (
    <section className={`app-screen ${className}`}>
      {!hideHeader && (
        <header className="app-header">
          {onBack ? (
            <button type="button" className="app-back" onClick={onBack} aria-label="返回">
              <Mdi path={mdiArrowLeft} size={22} />
            </button>
          ) : (
            <span className="app-back ghost" />
          )}
          <div className="app-title-wrap">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="app-header-right">{right}</div>
        </header>
      )}
      <div className={`app-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Mdi path={mdiStarFourPoints} size={30} />
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="error-note">
      <Mdi path={mdiAlertCircleOutline} size={16} />
      <span>{children}</span>
    </div>
  );
}

export const ICONS = {
  send: mdiSend,
  image: mdiImagePlus,
  mic: mdiMicrophone,
  volume: mdiVolumeHigh,
  plus: mdiPlus,
  trash: mdiTrashCanOutline,
  edit: mdiPencilOutline,
  upload: mdiUpload,
  download: mdiDownload,
  close: mdiClose,
  heart: mdiHeart,
  heartOutline: mdiHeartOutline,
  comment: mdiCommentOutline,
  refresh: mdiRefresh,
  check: mdiCheck,
  spark: mdiStarFourPoints,
};

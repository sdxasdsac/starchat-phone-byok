'use client';

// 移植自 ai-virtual-phone-main/components/desktop-shell.tsx（外壳 + 状态栏段）
// 只做路径/类型适配：DOM 层级、class 名、SVG 路径、尺寸变量与源项目保持一致。
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

function StatusClock() {
  const [label, setLabel] = useState('--:--');

  useEffect(() => {
    const update = () => {
      setLabel(
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      );
    };
    update();
    const timer = window.setInterval(update, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className="status-time">{label}</span>;
}

export function FloatPhoneShell({
  children,
  dock,
  hideTopBar = false,
  hideCase = false,
  fill = false,
  statusBarDropPx = 0,
}: {
  children?: ReactNode;
  /** Dock 在源项目里是 .phone-shell 的直接子节点（.phone-workspace 的兄弟），因此单独传入 */
  dock?: ReactNode;
  hideTopBar?: boolean;
  /** 隐藏机身边框（源 [data-hide-case="1"]），接入真实小手机时用 */
  hideCase?: boolean;
  /** 撑满父容器（覆盖 --phone-screen-width/height），接入时用 */
  fill?: boolean;
  statusBarDropPx?: number;
}) {
  return (
    <section
      className="phone-shell-wrap"
      style={
        {
          '--status-bar-drop': `${statusBarDropPx}px`,
          ...(fill
            ? { '--phone-screen-width': '100%', '--phone-screen-height': '100%', width: '100%', height: '100%' }
            : {}),
        } as CSSProperties
      }
      data-hide-top-bar={hideTopBar ? '1' : '0'}
      data-hide-case={hideCase ? '1' : '0'}
    >
      <div className="phone-case">
        <div className="phone-frame">
          <div className="phone-shell" data-ui="phone-screen" data-active-app="" data-app="">
            <div className="phone-wallpaper" />

            <header className="phone-status-bar">
              <StatusClock />
              <div className="status-island" />
              <div className="status-right" aria-hidden>
                <svg viewBox="0 0 72 51" className="status-signal" fill="currentColor">
                  <path d="M11.6,41.9c0,1.4,0,2.8,0,4.3c0,2.3-1.4,3.7-3.6,3.8c-1.5,0.1-3,0.1-4.4,0c-1.9-0.1-3.2-1.2-3.4-3c-0.3-3.4-0.2-6.8,0-10.1c0.1-1.8,1.5-3,3.3-3.1c1.5-0.1,3-0.1,4.4,0c2.2,0.1,3.6,1.5,3.7,3.8C11.6,39,11.6,40.5,11.6,41.9z" />
                  <path d="M31.7,36.9c0,2.8,0,5.7,0,8.5c0,3.5-1.1,4.6-4.5,4.6c-1.2,0-2.4,0-3.6,0c-2-0.1-3.4-1.5-3.4-3.4c-0.1-6.5-0.1-13,0-19.6c0-1.9,1.6-3.4,3.6-3.5c1.4-0.1,2.7,0,4.1,0c2.3,0.1,3.8,1.4,3.8,3.8C31.8,30.5,31.7,33.7,31.7,36.9z" />
                  <path d="M40.4,30.3c0-5,0-10.1,0-15.1c0-3,1.2-4.2,4.2-4.2c1,0,2,0,3,0c2.9,0,4.2,1.4,4.2,4.2c0,9,0,17.9,0,26.9c0,1.4,0,2.7,0,4.1c0,2.3-1.4,3.8-3.7,3.8c-1.3,0-2.6,0-3.9,0c-2.5-0.1-3.8-1.3-3.8-3.9C40.4,40.9,40.4,35.6,40.4,30.3z" />
                  <path d="M72,25.7c0,6.6,0,13.3,0,19.9c0,3.2-1.2,4.4-4.4,4.4c-1.1,0-2.3,0-3.4,0c-2.3-0.1-3.7-1.4-3.8-3.8c0-2.9,0-5.8,0-8.7c0-10.6,0-21.2,0-31.8c0-3.3,1.2-4.5,4.5-4.5c0.9,0,1.8,0,2.7,0c3.1,0,4.4,1.3,4.4,4.5C72,12.3,72,19,72,25.7z" />
                </svg>
                <svg viewBox="98 0 67 51" className="status-wifi" fill="currentColor">
                  <path d="M134.6,0c9.8,0.1,20.4,4.8,29.2,13.7c1.6,1.6,1.6,2.1,0,3.8c-0.8,0.8-1.6,1.6-2.3,2.5c-1.1,1.3-2.1,1.2-3.3,0c-3.5-3.7-7.6-6.5-12.3-8.6c-13-5.6-28.3-2.7-38.7,7.3c-0.5,0.5-0.9,0.9-1.4,1.4c-1,1.1-2,1.1-3-0.1c-0.9-1.1-2-2-3-3.1c-0.9-0.9-0.9-1.8,0-2.8C107.7,5.4,119.9,0,134.6,0z" />
                  <path d="M132.1,13.9c8.9,0.2,16.5,3.5,22.8,9.8c1.1,1.1,1.1,2.1,0,3.2c-0.9,0.9-1.8,1.9-2.7,2.8c-1.1,1.2-2,1.1-3.1,0c-3.9-3.9-8.6-6.3-14.1-6.9c-7.5-0.9-13.9,1.5-19.4,6.5c-1.9,1.8-2.1,1.8-3.9,0c-0.8-0.8-1.6-1.7-2.5-2.6c-1.1-1-1-2,0-3C115.5,17.5,123.1,14.1,132.1,13.9z" />
                  <path d="M131.9,27.8c5.4,0.1,9.8,2,13.6,5.5c1.1,1,1.2,2,0.1,3c-0.9,0.9-1.9,1.8-2.7,2.8c-1.1,1.4-2.1,1.3-3.4,0.2c-3.6-3-7.7-3.7-12.1-1.9c-1.3,0.5-2.4,1.3-3.4,2.2c-0.9,0.8-1.8,0.9-2.6-0.1c-1.1-1.1-2.1-2.2-3.2-3.3c-0.9-1-0.8-1.8,0.1-2.8C122.2,29.8,126.8,27.9,131.9,27.8z" />
                  <path d="M132,41.6c1.8,0,3.5,0.5,5,1.6c0.9,0.6,1.1,1.3,0.2,2.2c-1.5,1.5-2.9,2.9-4.4,4.4c-0.7,0.7-1.2,0.6-1.8,0c-1.5-1.6-2.9-3.1-4.4-4.6c-0.7-0.8-0.5-1.3,0.2-1.9C128.4,42.1,130.1,41.5,132,41.6z" />
                </svg>
                <svg viewBox="0 0 26 12" className="status-battery" fill="currentColor">
                  <rect x="0.5" y="0.5" width="22" height="11" rx="2.6" fill="none" stroke="currentColor" strokeOpacity="0.42" strokeWidth="1" />
                  <rect x="22.7" y="4" width="1.8" height="4" rx="0.7" opacity="0.42" />
                  <rect x="2" y="2" width="14" height="8" rx="1.5" />
                </svg>
              </div>
            </header>

            {children}
            {dock}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;

/**
 * Hides the browser UI. Useful until the app is served over HTTPS and can be installed as a PWA;
 * not shown when already running as an installed app.
 */
export function FullscreenButton({ className = 'icon-btn' }: { className?: string }) {
  const [active, setActive] = useState(() => !!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!document.fullscreenEnabled || isStandalone()) return null;

  const toggle = () =>
    (active ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' })).catch(
      () => {},
    );

  return (
    <button className={className} onClick={toggle} aria-label={active ? 'Exit fullscreen' : 'Fullscreen'} title={active ? 'Exit fullscreen' : 'Fullscreen'}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {active ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}

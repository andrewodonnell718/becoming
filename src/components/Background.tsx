import { useEffect, useRef, useState } from 'react';

export function Background() {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // iOS pauses background video when the PWA is backgrounded; resume on return.
    const resume = () => document.visibilityState === 'visible' && v.play().catch(() => {});
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);

  return (
    <div className="bg" aria-hidden>
      {!reduced && (
        <video
          ref={ref}
          className={ready ? 'ready' : ''}
          src={`${import.meta.env.BASE_URL}bg.mp4`}
          poster={`${import.meta.env.BASE_URL}bg-poster.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => setReady(true)}
        />
      )}
    </div>
  );
}

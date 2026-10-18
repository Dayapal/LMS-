import { useEffect, useRef, useState } from 'react';
import { studyMaterialsApi } from './api.js';

const HEARTBEAT_INTERVAL_MS = 25000;
const IDLE_TIMEOUT_MS = 45000;

/**
 * Reading telemetry hook that tracks actual engaged reading duration.
 * Pauses when tab is hidden or student is idle, and sends periodic heartbeats.
 */
export function useReadingTelemetry({ bookSlug, moduleSlug, enabled = true, initialSeconds = 0 }) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [isIdle, setIsIdle] = useState(false);

  const accumulatedSeconds = useRef(0);
  const lastActivityTime = useRef(Date.now());
  const isDocumentVisible = useRef(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
  );

  // Sync initial seconds if received later
  useEffect(() => {
    if (initialSeconds > 0) {
      setTotalSeconds((prev) => Math.max(prev, initialSeconds));
    }
  }, [initialSeconds]);

  useEffect(() => {
    if (!enabled || !bookSlug || !moduleSlug) return;

    const handleUserActivity = () => {
      lastActivityTime.current = Date.now();
      setIsIdle(false);
    };

    const handleVisibilityChange = () => {
      isDocumentVisible.current = document.visibilityState === 'visible';
      if (!isDocumentVisible.current) {
        setIsIdle(true);
      } else {
        lastActivityTime.current = Date.now();
        setIsIdle(false);
      }
    };

    // Activity listeners
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 1-second ticker for active engagement
    const tickInterval = window.setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime.current;

      if (timeSinceActivity > IDLE_TIMEOUT_MS) {
        setIsIdle(true);
        return;
      }

      if (isDocumentVisible.current) {
        accumulatedSeconds.current += 1;
        setTotalSeconds((prev) => prev + 1);
      }
    }, 1000);

    // Periodic heartbeat sync
    const flushHeartbeat = async () => {
      const secondsToFlush = accumulatedSeconds.current;
      if (secondsToFlush < 1) return;

      accumulatedSeconds.current = 0;
      try {
        await studyMaterialsApi.sendHeartbeat({
          bookSlug,
          moduleSlug,
          activeSeconds: secondsToFlush,
        });
      } catch {
        // Restore if failed
        accumulatedSeconds.current += secondsToFlush;
      }
    };

    const heartbeatInterval = window.setInterval(flushHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(tickInterval);
      clearInterval(heartbeatInterval);

      // Flush remaining on cleanup
      if (accumulatedSeconds.current > 0) {
        const remaining = accumulatedSeconds.current;
        accumulatedSeconds.current = 0;
        studyMaterialsApi
          .sendHeartbeat({
            bookSlug,
            moduleSlug,
            activeSeconds: remaining,
          })
          .catch(() => {});
      }
    };
  }, [bookSlug, moduleSlug, enabled]);

  return {
    totalReadingSeconds: totalSeconds,
    isIdle,
  };
}

import { useState, useRef, useEffect, useCallback } from "react";

const THRESHOLD = 72;

export function usePullToRefresh(onRefresh) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const isPulling = useRef(false);

  const stableRefresh = useCallback(onRefresh, []);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = false;
      }
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        isPulling.current = true;
        setPullY(Math.min(delta * 0.5, THRESHOLD + 16));
      }
    };

    const onTouchEnd = async () => {
      if (!isPulling.current) { startY.current = null; return; }
      const currentPull = pullY;
      setPullY(0);
      startY.current = null;
      isPulling.current = false;
      if (currentPull >= THRESHOLD * 0.5) {
        setRefreshing(true);
        await stableRefresh();
        setRefreshing(false);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [stableRefresh, pullY]);

  return { pullY, refreshing, threshold: THRESHOLD };
}
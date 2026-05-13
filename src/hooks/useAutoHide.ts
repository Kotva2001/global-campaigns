import { useEffect, useState } from "react";

/** Boolean state that flips back to false after `ms` when set true. */
export function useAutoHide(ms = 10000) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(t);
  }, [shown, ms]);
  return [shown, setShown] as const;
}

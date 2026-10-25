import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
/** Recalculate at local midnight and when returning to the app. */
export function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setToday(now);
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      clearTimeout(timer);
      timer = setTimeout(update, midnight.getTime() - now.getTime() + 50);
    };
    update();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return today;
}

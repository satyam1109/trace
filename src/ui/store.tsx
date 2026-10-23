import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { ledger, isBrowser } from '../services/ledger';
import {
  initialPreferences,
  normaliseFinance,
  type FinanceState,
  type Preferences,
} from '../finance/model';
import type { ManualExpense, Snapshot, Transaction } from '../types';
export type FinanceStore = {
  snapshot: Snapshot | null;
  finance: FinanceState;
  preferences: Preferences;
  transactions: Transaction[];
  demo: boolean;
  setDemo: (v: boolean) => void;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  locked: boolean;
  authenticate: () => Promise<boolean>;
  refresh: () => Promise<void>;
  saveFinance: (fn: (state: FinanceState) => FinanceState) => Promise<void>;
  savePreferences: (patch: Partial<Preferences>) => Promise<void>;
  create: (input: ManualExpense) => Promise<Transaction>;
  edit: (input: Transaction) => Promise<void>;
  discard: (id: string) => Promise<void>;
  reset: () => Promise<void>;
};
const Context = createContext<FinanceStore | null>(null);
export function useFinance() {
  const value = useContext(Context);
  if (!value) throw Error('Missing finance provider');
  return value;
}
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [demo, setDemo] = useState(isBrowser),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [locked, setLocked] = useState(true);
  const ref = useRef<Snapshot | null>(null),
    pending = useRef(false),
    mounted = useRef(true),
    authenticating = useRef(false),
    first = useRef(true),
    currentDemo = useRef(demo),
    last = useRef('');
  currentDemo.current = demo;
  const refresh = useCallback(async () => {
    const next = await ledger.getSnapshot();
    if (!mounted.current) return;
    ref.current = next;
    const json = JSON.stringify(next);
    if (json !== last.current) {
      last.current = json;
      setSnapshot(next);
    }
    if (first.current) {
      first.current = false;
      setLocked(!isBrowser && !!next.preferences?.appLock);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const load = () =>
      refresh().catch(e => {
        if (mounted.current) {
          setError(
            e instanceof Error ? e.message : 'Could not load local records.',
          );
          setLoading(false);
        }
      });
    load();
    const interval = setInterval(() => {
      if (isBrowser || AppState.currentState === 'active') load();
    }, 3000);
    const sub = AppState.addEventListener('change', s => {
      if (
        s === 'background' &&
        ref.current?.preferences?.appLock &&
        !authenticating.current
      )
        setLocked(true);
      if (s === 'active') load();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      clearInterval(interval);
    };
  }, [refresh]);
  const perform = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      if (pending.current) throw Error('A save is already in progress.');
      pending.current = true;
      try {
        const result = await action();
        await refresh();
        return result;
      } finally {
        pending.current = false;
      }
    },
    [refresh],
  );
  const authenticate = useCallback(async () => {
    if (authenticating.current) return false;
    authenticating.current = true;
    try {
      const ok = await ledger.authenticate();
      if (ok) setLocked(false);
      return ok;
    } finally {
      authenticating.current = false;
    }
  }, []);
  const preferences = { ...initialPreferences, ...snapshot?.preferences };
  const finance = normaliseFinance(
    snapshot?.planning?.[demo ? 'demo' : 'live'] || {},
  );
  const value: FinanceStore = {
    snapshot,
    finance,
    preferences,
    transactions: (snapshot?.transactions || []).filter(t => t.demo === demo),
    demo,
    setDemo,
    loading,
    error,
    setError,
    locked,
    authenticate,
    refresh,
    saveFinance: fn =>
      perform(async () => {
        const state = normaliseFinance(
          ref.current?.planning?.[currentDemo.current ? 'demo' : 'live'] || {},
        );
        await ledger.saveFinance(currentDemo.current, fn(state));
      }),
    savePreferences: patch =>
      perform(async () => {
        await ledger.savePreferences({
          ...initialPreferences,
          ...ref.current?.preferences,
          ...patch,
        });
      }),
    create: input => perform(() => ledger.createManual(input)),
    edit: input => perform(() => ledger.editTransaction(input)),
    discard: id => perform(() => ledger.discardTransaction(id)),
    reset: () =>
      perform(async () => {
        await ledger.resetAllData();
        setLocked(false);
      }),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

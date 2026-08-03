"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { callerIdSeed } from "./mockData";
import { normalizeNumber } from "./format";

export type CallerIdEntry = { id: string; number: string; name: string };

type Ctx = {
  entries: CallerIdEntry[];
  addEntry: (number: string, name: string) => void;
  updateEntry: (id: string, number: string, name: string) => void;
  removeEntry: (id: string) => void;
  nameFor: (number: string) => string | undefined;
};

const CallerIdContext = createContext<Ctx | null>(null);

const ENTRIES_KEY = "callerId.entries";

function seedEntries(): CallerIdEntry[] {
  return callerIdSeed.map((e, i) => ({ id: `seed-${i}`, ...e }));
}

export function CallerIdProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CallerIdEntry[]>(seedEntries);

  // Restore from localStorage on mount.
  useEffect(() => {
    try {
      const rawE = localStorage.getItem(ENTRIES_KEY);
      if (rawE) setEntries(JSON.parse(rawE));
    } catch {}
  }, []);

  const persist = useCallback((next: CallerIdEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const addEntry = useCallback(
    (number: string, name: string) => {
      const entry: CallerIdEntry = {
        id: `cid-${Date.now()}`,
        number: number.trim(),
        name: name.trim(),
      };
      persist([entry, ...entries]);
    },
    [entries, persist]
  );

  const updateEntry = useCallback(
    (id: string, number: string, name: string) => {
      persist(
        entries.map((e) =>
          e.id === id ? { ...e, number: number.trim(), name: name.trim() } : e
        )
      );
    },
    [entries, persist]
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(entries.filter((e) => e.id !== id));
    },
    [entries, persist]
  );

  const nameFor = useCallback(
    (number: string) => {
      const key = normalizeNumber(number);
      const hit = entries.find((e) => normalizeNumber(e.number) === key);
      return hit?.name || undefined;
    },
    [entries]
  );

  const value = useMemo<Ctx>(
    () => ({ entries, addEntry, updateEntry, removeEntry, nameFor }),
    [entries, addEntry, updateEntry, removeEntry, nameFor]
  );

  return (
    <CallerIdContext.Provider value={value}>{children}</CallerIdContext.Provider>
  );
}

export function useCallerId(): Ctx {
  const ctx = useContext(CallerIdContext);
  if (!ctx) throw new Error("useCallerId must be used within CallerIdProvider");
  return ctx;
}

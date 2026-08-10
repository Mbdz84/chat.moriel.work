"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "./supabase/client";
import { normalizeNumber } from "./format";
import { useCompany } from "./company";

export type CallerIdEntry = { id: string; number: string; name: string };

type Ctx = {
  entries: CallerIdEntry[];
  addEntry: (number: string, name: string) => Promise<void>;
  updateEntry: (id: string, number: string, name: string) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  nameFor: (number: string) => string | undefined;
  reload: () => Promise<void>;
};

const CallerIdContext = createContext<Ctx | null>(null);

export function CallerIdProvider({ children }: { children: React.ReactNode }) {
  const { active } = useCompany();
  const companyId = active?.companyId ?? null;
  const [entries, setEntries] = useState<CallerIdEntry[]>([]);

  const reload = useCallback(async () => {
    if (!companyId) {
      setEntries([]);
      return;
    }
    const s = createClient();
    const { data } = await s
      .from("caller_id")
      .select("id, number, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    setEntries((data ?? []) as CallerIdEntry[]);
  }, [companyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEntry = useCallback(
    async (number: string, name: string) => {
      if (!companyId) return;
      const s = createClient();
      await s
        .from("caller_id")
        .insert({ company_id: companyId, number: number.trim(), name: name.trim() });
      await reload();
    },
    [companyId, reload]
  );

  const updateEntry = useCallback(
    async (id: string, number: string, name: string) => {
      const s = createClient();
      await s
        .from("caller_id")
        .update({ number: number.trim(), name: name.trim() })
        .eq("id", id);
      await reload();
    },
    [reload]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      const s = createClient();
      await s.from("caller_id").delete().eq("id", id);
      await reload();
    },
    [reload]
  );

  const nameFor = useCallback(
    (number: string) => {
      const key = normalizeNumber(number);
      return entries.find((e) => normalizeNumber(e.number) === key)?.name || undefined;
    },
    [entries]
  );

  const value = useMemo<Ctx>(
    () => ({ entries, addEntry, updateEntry, removeEntry, nameFor, reload }),
    [entries, addEntry, updateEntry, removeEntry, nameFor, reload]
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

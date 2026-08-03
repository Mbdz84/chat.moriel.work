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

export type CompanyMembership = {
  companyId: string;
  code: string;
  name: string;
  role: "admin" | "viewer";
};

type Ctx = {
  companies: CompanyMembership[];
  active: CompanyMembership | null;
  setActive: (companyId: string) => void;
  loading: boolean;
  isAdmin: boolean;
};

const CompanyContext = createContext<Ctx | null>(null);
const KEY = "activeCompanyId";

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("memberships")
        .select("role, companies(id, code, name)");
      if (cancelled) return;
      if (error || !data) {
        setCompanies([]);
        setLoading(false);
        return;
      }
      const list: CompanyMembership[] = data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => {
          const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
          if (!c) return null;
          return {
            companyId: c.id as string,
            code: c.code as string,
            name: c.name as string,
            role: row.role as "admin" | "viewer",
          };
        })
        .filter(Boolean) as CompanyMembership[];

      setCompanies(list);

      let saved: string | null = null;
      try {
        saved = localStorage.getItem(KEY);
      } catch {}
      const chosen =
        list.find((c) => c.companyId === saved)?.companyId ??
        list[0]?.companyId ??
        null;
      setActiveId(chosen);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActive = useCallback((companyId: string) => {
    setActiveId(companyId);
    try {
      localStorage.setItem(KEY, companyId);
    } catch {}
  }, []);

  const active = useMemo(
    () => companies.find((c) => c.companyId === activeId) ?? null,
    [companies, activeId]
  );

  const value = useMemo<Ctx>(
    () => ({
      companies,
      active,
      setActive,
      loading,
      isAdmin: active?.role === "admin",
    }),
    [companies, active, setActive, loading]
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany(): Ctx {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

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
  reload: () => Promise<void>;
};

const CompanyContext = createContext<Ctx | null>(null);
const KEY = "activeCompanyId";

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    // Platform super-admins see (and can enter) every company.
    let isSuper = false;
    try {
      const r = await fetch("/api/admin/context");
      const d = (await r.json()) as { isSuperadmin?: boolean };
      isSuper = Boolean(d.isSuperadmin);
    } catch {}

    let list: CompanyMembership[] = [];

    if (isSuper) {
      const { data: comps } = await supabase
        .from("companies")
        .select("id, code, name, disabled")
        .order("created_at", { ascending: true });
      list = (comps ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => !c.disabled)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          companyId: c.id as string,
          code: c.code as string,
          name: c.name as string,
          role: "admin" as const,
        }));
    } else {
      const { data, error } = await supabase
        .from("memberships")
        .select("role, disabled, companies(id, code, name, disabled)")
        .eq("user_id", user.id);
      if (error || !data) {
        setCompanies([]);
        setLoading(false);
        return;
      }
      list = data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => {
          if (row.disabled) return null;
          const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
          if (!c || c.disabled) return null;
          return {
            companyId: c.id as string,
            code: c.code as string,
            name: c.name as string,
            role: row.role as "admin" | "viewer",
          };
        })
        .filter(Boolean) as CompanyMembership[];
    }

    setCompanies(list);
    setActiveId((prev) => {
      let saved: string | null = prev;
      if (!saved) {
        try {
          saved = localStorage.getItem(KEY);
        } catch {}
      }
      return list.find((c) => c.companyId === saved)?.companyId ?? list[0]?.companyId ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
      reload,
    }),
    [companies, active, setActive, loading, reload]
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

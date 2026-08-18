import TopBar from "@/components/TopBar";
import ViewportHeight from "@/components/ViewportHeight";
import { CallerIdProvider } from "@/lib/callerId";
import { CompanyProvider } from "@/lib/company";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompanyProvider>
      <CallerIdProvider>
        <ViewportHeight />
        <div
          style={{ height: "var(--app-height, 100dvh)" }}
          className="flex flex-col overflow-hidden"
        >
          <TopBar />
          <main className="flex-1 min-h-0">{children}</main>
        </div>
      </CallerIdProvider>
    </CompanyProvider>
  );
}

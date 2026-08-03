import TopBar from "@/components/TopBar";
import { CallerIdProvider } from "@/lib/callerId";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CallerIdProvider>
      <div className="h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 min-h-0">{children}</main>
      </div>
    </CallerIdProvider>
  );
}

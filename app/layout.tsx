import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat Console",
  description: "SMS chat console",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Chat", statusBarStyle: "default" },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

// Runs before paint to set the theme class and avoid a flash of the wrong theme.
const themeInit = `
try {
  var t = localStorage.getItem('theme');
  var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
  var f = localStorage.getItem('fontScale');
  if (f) document.documentElement.style.fontSize = f + 'px';
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import OfflineBanner from "@/components/OfflineBanner";
import InstallAppButton from "@/components/InstallAppButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Internal Mobility Desk",
  description: "A simple ride coordination desk for students, employees, and riders.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = { themeColor: "#22a06b", width: "device-width", initialScale: 1 };

const themeBootstrap = `try {
  const theme = localStorage.getItem("mobility-theme");
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
} catch {}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-950">
        <OfflineBanner />
        <Navbar />
        {children}
        <footer className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 bg-white px-4 py-4 text-center sm:flex-row sm:gap-5 sm:px-6">
          <div><p className="text-xs font-semibold text-slate-700">Internal Mobility Desk</p><p className="mt-1 text-xs text-slate-500">Built for simple shared campus mobility.</p></div>
          <InstallAppButton />
        </footer>
      </body>
    </html>
  );
}

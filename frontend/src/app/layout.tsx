import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AstraGuard AI — Space Debris Tracker",
  description:
    "Real-time orbital debris monitoring and conjunction analysis powered by live TLE data.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#020818] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

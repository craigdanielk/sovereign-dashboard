import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/shell/ClientShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// Prevent static prerender — layout uses client providers (TenantContext)
// that fail during /_global-error prerender in Next.js 16.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sovereign",
  description: "North Star command surface — multi-agent orchestration dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}

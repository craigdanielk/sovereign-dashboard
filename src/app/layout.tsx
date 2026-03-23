import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell/Shell";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SOVEREIGN \u2014 Command Surface",
  description: "Spatial operations workspace for multi-agent orchestration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

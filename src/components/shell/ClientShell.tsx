"use client";

import dynamic from "next/dynamic";

const Shell = dynamic(() => import("./Shell"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100vh", background: "#0a0a0a" }} />
  ),
});

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

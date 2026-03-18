"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/graph", label: "Graph" },
  { href: "/templates", label: "Templates" },
  { href: "/jobs", label: "Jobs" },
  { href: "/demos", label: "Demos" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200"
            style={{
              fontFamily: "var(--font-mono)",
              background: active
                ? "rgba(255,255,255,0.1)"
                : "transparent",
              color: active ? "var(--text-1)" : "var(--text-3)",
              border: active
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid transparent",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

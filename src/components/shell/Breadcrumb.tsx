"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "@/lib/types";

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Root", href: "/" }];

  if (pathname === "/") return crumbs;

  const segments = pathname.split("/").filter(Boolean);

  // Match tab
  const tab = TABS.find((t) => t.path === `/${segments[0]}`);
  if (tab) {
    crumbs.push({ label: tab.label, href: tab.path });
  }

  // Sub-segments
  if (segments.length > 1) {
    crumbs.push({
      label: decodeURIComponent(segments.slice(1).join("/")),
      href: pathname,
    });
  }

  // Legacy routes
  if (segments[0] === "ws" && segments[1]) {
    crumbs.push({ label: segments[1].toUpperCase(), href: `/ws/${segments[1]}` });
  }
  if (segments[0] === "ops") {
    crumbs.push({ label: "Ops (Legacy)", href: "/ops" });
  }
  if (segments[0] === "item") {
    crumbs.push({
      label: `${segments[1]} #${segments[2]}`,
      href: pathname,
    });
  }

  return crumbs;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav className="flex items-center gap-1 text-[10px] text-text-muted overflow-x-auto">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-border">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="text-text-secondary">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-text-secondary transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Root", href: "/" }];

  if (pathname === "/") return crumbs;

  const segments = pathname.split("/").filter(Boolean);

  // /ws/[slug]
  if (segments[0] === "ws" && segments[1]) {
    crumbs.push({ label: decodeURIComponent(segments[1]).toUpperCase(), href: `/ws/${segments[1]}` });
    // /ws/r17/[client]
    if (segments[1] === "r17" && segments[2]) {
      crumbs.push({
        label: decodeURIComponent(segments[2]).replace(/-/g, " "),
        href: `/ws/r17/${segments[2]}`,
      });
    }
  }

  // /comms or /comms/[filter]
  if (segments[0] === "comms") {
    crumbs.push({ label: "Comms Hub", href: "/comms" });
    if (segments[1]) {
      crumbs.push({
        label: decodeURIComponent(segments[1]),
        href: `/comms/${segments[1]}`,
      });
    }
  }

  // /item/[type]/[id]
  if (segments[0] === "item" && segments[1] && segments[2]) {
    crumbs.push({
      label: `${segments[1]} #${segments[2]}`,
      href: `/item/${segments[1]}/${segments[2]}`,
    });
  }

  // /ops (legacy dashboard)
  if (segments[0] === "ops") {
    crumbs.push({ label: "Ops Dashboard", href: "/ops" });
  }

  return crumbs;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav className="flex items-center gap-1.5 text-xs text-text-muted overflow-x-auto">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5 shrink-0">
          {i > 0 && <span className="text-border">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="text-text-primary font-medium">{crumb.label}</span>
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

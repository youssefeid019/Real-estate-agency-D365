"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; short?: string; match?: string[] }[] = [
  { href: "/", label: "Facilities" },
  { href: "/groups", label: "Groups" },
  { href: "/report", label: "Report a problem", short: "Report", match: ["/report", "/track"] },
  { href: "/manage", label: "My booking" },
];

// Main navigation with the current page highlighted
export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-links">
        {LINKS.map((link) => {
          const active = (link.match ?? [link.href]).includes(pathname);
          return (
            <Link key={link.href} href={link.href} className="nav-link" aria-current={active ? "page" : undefined}>
              {link.short ? (
                <>
                  <span className="label-long">{link.label}</span>
                  <span className="label-short">{link.short}</span>
                </>
              ) : (
                link.label
              )}
            </Link>
          );
        })}
      </div>
      <Link href="/book" className="button sm" aria-current={pathname === "/book" ? "page" : undefined}>
        Book now
      </Link>
    </nav>
  );
}

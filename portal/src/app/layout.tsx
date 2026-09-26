import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "./nav";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "YE Sports Facilities", template: "%s | YE Sports Facilities" },
  description: "See live availability and book a pitch, court or pool slot in seconds.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c100d" },
  ],
};

// Site shell: header, navigation and footer
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <div className="backdrop" aria-hidden="true" />
        <header className="site-header">
          <div className="shell header-row">
            <Link href="/" className="brand" aria-label="YE Sports Facilities home">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="30" height="30">
                  <rect width="32" height="32" rx="9" fill="currentColor" />
                  <circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M7.5 16h17M16 7.5c-3.2 2.8-3.2 14.2 0 17M16 7.5c3.2 2.8 3.2 14.2 0 17" fill="none" stroke="#fff" strokeWidth="1.8" />
                </svg>
              </span>
              <span>
                YE <b>Sports</b>
              </span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="shell">{children}</main>
        <footer className="site-footer">
          <div className="shell footer-row">
            <div>
              <div className="brand small">
                YE <b>Sports</b> Facilities
              </div>
              <p className="muted small">Community pitches, courts and pools. Book by the hour, no account needed.</p>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <Link href="/">Facilities</Link>
              <Link href="/book">Book a slot</Link>
              <Link href="/groups">Group &amp; corporate</Link>
              <Link href="/manage">Manage a booking</Link>
              <Link href="/report">Report a problem</Link>
              <Link href="/track">Track a report</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

const NAV_LINKS = [
  { label: "Play", href: "/game" },
  { label: "Duels", href: "/duels" },
  { label: "Lo-fi", href: "/lofi" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        Sync
      </Link>
      <ul className={styles.links}>
        {NAV_LINKS.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className={pathname.startsWith(href) ? styles.active : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

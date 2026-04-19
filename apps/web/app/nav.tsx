'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LoginButton } from '@/components/auth/LoginButton';

const LINKS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/play', label: 'Play' },
  { href: '/replays', label: 'Replays' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Nav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="nav glass">
      <div className="nav-inner">
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="nav-logo">
            <span className="gradient-text">⬡ Caro On-Chain</span>
          </div>
        </Link>

        <div className="nav-links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href, link.exact) ? 'nav-link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}

          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'var(--color-border)',
              margin: '0 0.25rem',
            }}
          />
          <LoginButton />
        </div>
      </div>
    </nav>
  );
}

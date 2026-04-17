import { useState, useRef, useEffect } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClientQuery,
} from '@mysten/dapp-kit';

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBalance(rawBalance: string): string {
  const sui = Number(rawBalance) / 1_000_000_000;
  if (sui === 0) return '0 SUI';
  if (sui < 0.001) return '< 0.001 SUI';
  return `${sui.toFixed(4)} SUI`;
}

export function LoginButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch SUI balance
  const { data: balanceData } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address ?? '' },
    { enabled: !!account?.address, refetchInterval: 10_000 },
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCopy = async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = account.address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!account) {
    return <ConnectButton connectText="🔐 Connect" />;
  }

  const balance = balanceData?.totalBalance ?? '0';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.85rem',
          borderRadius: '10px',
          border: '1px solid var(--color-border-bright)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.85rem',
          fontWeight: 500,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
          e.currentTarget.style.background = 'var(--color-surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-bright)';
          e.currentTarget.style.background = 'var(--color-surface)';
        }}
      >
        {/* Green dot */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#34d399',
          boxShadow: '0 0 6px #34d399',
          flexShrink: 0,
        }} />
        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
          {formatAddress(account.address)}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '260px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-bright)',
            borderRadius: '14px',
            padding: '0.5rem',
            zIndex: 200,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Address row — click to copy */}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: '10px',
              border: 'none',
              background: copied ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.background = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Wallet icon */}
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-player-x))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              flexShrink: 0,
            }}>
              👛
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                color: 'var(--color-text-primary)',
                fontWeight: 600,
              }}>
                {formatAddress(account.address)}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: copied ? '#34d399' : 'var(--color-text-muted)',
                marginTop: '1px',
                transition: 'color 0.2s ease',
              }}>
                {copied ? '✓ Copied to clipboard!' : 'Click to copy address'}
              </div>
            </div>
            {/* Copy icon */}
            <span style={{
              color: copied ? '#34d399' : 'var(--color-text-muted)',
              fontSize: '1rem',
              transition: 'color 0.2s ease',
            }}>
              {copied ? '✓' : '📋'}
            </span>
          </button>

          {/* Divider */}
          <div style={{
            height: '1px',
            background: 'var(--color-border)',
            margin: '0.35rem 0.75rem',
          }} />

          {/* Balance row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 0.75rem',
            borderRadius: '10px',
          }}>
            {/* SUI icon */}
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              flexShrink: 0,
            }}>
              💎
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--color-text-muted)',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                SUI Balance
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 700,
                background: Number(balance) > 0
                  ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                  : 'none',
                color: Number(balance) > 0 ? undefined : 'var(--color-text-secondary)',
                WebkitBackgroundClip: Number(balance) > 0 ? 'text' : undefined,
                WebkitTextFillColor: Number(balance) > 0 ? 'transparent' : undefined,
              }}>
                {formatBalance(balance)}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            height: '1px',
            background: 'var(--color-border)',
            margin: '0.35rem 0.75rem',
          }} />

          {/* Disconnect button */}
          <button
            onClick={() => {
              disconnect();
              setDropdownOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span>🔌</span>
            Disconnect Wallet
          </button>
        </div>
      )}

      {/* Copied Toast */}
      {copied && (
        <div
          className="animate-slide-up"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: '#34d399',
            fontSize: '0.85rem',
            fontWeight: 600,
            zIndex: 999,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ✓ Copied!
        </div>
      )}
    </div>
  );
}

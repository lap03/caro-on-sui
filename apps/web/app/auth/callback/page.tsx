'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';

export default function AuthCallbackPage() {
  const router = useRouter();
  const account = useCurrentAccount();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    // Enoki's wallet SDK handles the OAuth callback via the hash fragment. We
    // just wait for dApp Kit to surface the connected account.
    const timer = setTimeout(() => {
      if (account) {
        setStatus('success');
        setTimeout(() => router.push('/play'), 1000);
      } else if (typeof window !== 'undefined' && window.location.hash) {
        setStatus('processing');
        setTimeout(() => {
          if (!account) setStatus('error');
        }, 5000);
      } else {
        setStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [account, router]);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
      {status === 'processing' && (
        <>
          <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1.5rem' }} />
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}
          >
            Completing Login...
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Generating your ZK proof. This may take a moment.
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}
          >
            <span className="gradient-text">Login Successful!</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>Redirecting to game...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}
          >
            Login Failed
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Something went wrong during authentication.
          </p>
          <button className="btn-primary" onClick={() => router.push('/')}>
            Back to Home
          </button>
        </>
      )}
    </div>
  );
}

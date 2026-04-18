import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LoginButton } from '@/components/auth/LoginButton';
import { Home } from '@/pages/Home';
import { Play } from '@/pages/Play';
import { Replay } from '@/pages/Replay';
import { LeaderboardPage } from '@/pages/Leaderboard';
import { AuthCallback } from '@/pages/AuthCallback';
import '@mysten/dapp-kit/dist/index.css';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div className="bg-glow bg-glow--purple" />
        <div className="bg-glow bg-glow--blue" />

        {/* Navigation */}
        <nav className="nav glass">
          <div className="nav-inner">
            <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="nav-logo">
                <span className="gradient-text">⬡ Caro On-Chain</span>
              </div>
            </NavLink>

            <div className="nav-links">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              >
                Home
              </NavLink>
              <NavLink
                to="/play"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              >
                Play
              </NavLink>
              <NavLink
                to="/replays"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              >
                Replays
              </NavLink>
              <NavLink
                to="/leaderboard"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              >
                Leaderboard
              </NavLink>

              <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 0.25rem' }} />
              <LoginButton />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Play />} />
            <Route path="/replays" element={<Replay />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </main>

        <Toaster
          position="top-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}

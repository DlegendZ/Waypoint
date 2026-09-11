import { useState, type FormEvent } from 'react';
import type { WaypointApi } from '../api/client';
import { DemoApi } from '../api/demo/demoApi';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../api/demo/engine';
import type { User } from '../api/types';
import { Brand } from '../components/Brand';
import { MapView, type MapMarker } from '../components/MapView';
import { errorMessage, usePolling } from '../lib/hooks';

interface AuthViewProps {
  api: WaypointApi;
  notice: string | null;
  onSignedIn: (user: User) => void;
  onOpenServer: () => void;
}

const DEMO_ROLES: { email: string; title: string; description: string }[] = [
  { email: DEMO_ACCOUNTS.customer, title: 'Customer', description: 'Order a delivery and track the driver live.' },
  { email: DEMO_ACCOUNTS.driver, title: 'Driver', description: 'Go online, take an order, drive it to the drop-off.' },
  { email: DEMO_ACCOUNTS.dispatcher, title: 'Dispatcher', description: 'Watch the whole fleet and every order.' },
];

export function AuthView({ api, notice, onSignedIn, onOpenServer }: AuthViewProps) {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fleet, setFleet] = useState<MapMarker[]>([]);

  const demo = api instanceof DemoApi ? api : null;

  // Demo mode: the simulated fleet cruising behind the sign-in panel.
  usePolling(
    () => {
      if (!demo) return;
      setFleet(
        demo.engine.fleetSnapshot().map((driver) => ({
          id: `fleet-${driver.id}`,
          position: driver.position,
          kind: driver.status === 'ONLINE_BUSY' ? 'driver-busy' : driver.status === 'OFFLINE' ? 'driver-offline' : 'driver-available',
        })),
      );
    },
    1000,
    !!demo,
  );

  const signIn = async (signInEmail: string, signInPassword: string) => {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(signInEmail, signInPassword));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tab === 'signin') {
      await signIn(email, password);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.register({ name: name.trim(), email: email.trim(), password, role });
      // Registration doesn't start a session on the server, so sign in straight after.
      onSignedIn(await api.login(email.trim(), password));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const switchTab = (next: 'signin' | 'register') => {
    setTab(next);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="auth">
      <MapView markers={fleet} interactive={false} initialZoom={13} className="auth__map" ariaLabel="Fleet map" />
      <main className="auth__panel">
        <Brand large />
        <p className="auth__lede">
          Order a delivery, get matched with the nearest free driver, and watch them cross the city on the map as it happens.
        </p>

        {notice && <p className="banner banner--warn">{notice}</p>}
        {info && <p className="banner">{info}</p>}

        {demo && (
          <section className="demo-accounts" aria-labelledby="demo-title">
            <h2 id="demo-title">Try it with a demo account</h2>
            <ul>
              {DEMO_ROLES.map((account) => (
                <li key={account.email}>
                  <button type="button" className="demo-account" disabled={busy} onClick={() => signIn(account.email, DEMO_PASSWORD)}>
                    <strong>{account.title}</strong>
                    <span>{account.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Open a second tab as another role — customer in one, driver in the other — to see the live link between them.
            </p>
          </section>
        )}

        <div className="tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={tab === 'signin'} className="tab" onClick={() => switchTab('signin')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={tab === 'register'} className="tab" onClick={() => switchTab('register')}>
            Create account
          </button>
        </div>

        <form className="form" onSubmit={submit} noValidate={false}>
          {tab === 'register' && (
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              minLength={tab === 'register' ? 8 : undefined}
              maxLength={72}
              required
            />
            {tab === 'register' && <span className="field__hint">8 to 72 characters.</span>}
          </label>
          {tab === 'register' && (
            <fieldset className="field">
              <legend>I want to</legend>
              <div className="segmented">
                <label className={role === 'CUSTOMER' ? 'is-on' : ''}>
                  <input type="radio" name="role" value="CUSTOMER" checked={role === 'CUSTOMER'} onChange={() => setRole('CUSTOMER')} />
                  Send deliveries
                </label>
                <label className={role === 'DRIVER' ? 'is-on' : ''}>
                  <input type="radio" name="role" value="DRIVER" checked={role === 'DRIVER'} onChange={() => setRole('DRIVER')} />
                  Drive
                </label>
              </div>
              <span className="field__hint">Dispatcher accounts are set up by an administrator.</span>
            </fieldset>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button button--primary button--wide" disabled={busy}>
            {busy ? 'One moment…' : tab === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <footer className="auth__footer">
          <span>
            {demo ? 'Demo data, stored only in this browser.' : `Connected to ${api.target}.`}{' '}
            <button type="button" className="link-button" onClick={onOpenServer}>
              Change
            </button>
          </span>
          <a href="https://github.com/DlegendZ/Waypoint" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </footer>
      </main>
    </div>
  );
}

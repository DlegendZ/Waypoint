import { useEffect, useMemo, useRef, useState } from 'react';
import type { WaypointApi } from './api/client';
import { DemoApi } from './api/demo/demoApi';
import { HttpApi } from './api/http';
import type { User } from './api/types';
import { Brand } from './components/Brand';
import { ServerDialog } from './components/ServerDialog';
import { ToastProvider } from './components/Toasts';
import { resolveTarget } from './config';
import { errorMessage } from './lib/hooks';
import { AuthView } from './views/AuthView';
import { CustomerView } from './views/CustomerView';
import { DispatcherView } from './views/DispatcherView';
import { DriverView } from './views/DriverView';

const ROLE_LABEL: Record<User['role'], string> = {
  CUSTOMER: 'Customer',
  DRIVER: 'Driver',
  DISPATCHER: 'Dispatcher',
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const sessionExpired = useRef<() => void>(() => {});

  const api: WaypointApi = useMemo(() => {
    const target = resolveTarget();
    return target.kind === 'demo' ? new DemoApi() : new HttpApi(target.baseUrl, () => sessionExpired.current());
  }, []);

  sessionExpired.current = () => {
    setUser(null);
    setNotice('Your session has ended. Sign in again.');
  };

  useEffect(() => {
    api
      .me()
      .then((current) => setUser(current))
      .catch((error) => setNotice(errorMessage(error)))
      .finally(() => setBooting(false));
  }, [api]);

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      // Signing out locally still works if the server is unreachable.
    }
    setNotice(null);
    setUser(null);
  };

  return (
    <ToastProvider>
      {booting ? (
        <div className="splash" aria-busy="true">
          <Brand large />
        </div>
      ) : !user ? (
        <AuthView
          api={api}
          notice={notice}
          onSignedIn={(signedIn) => {
            setNotice(null);
            setUser(signedIn);
          }}
          onOpenServer={() => setServerOpen(true)}
        />
      ) : (
        <div className="shell">
          <header className="topbar">
            <Brand />
            <div className="topbar__right">
              <button type="button" className={`source source--${api.mode}`} onClick={() => setServerOpen(true)}>
                {api.mode === 'demo' ? 'Demo data' : 'Live server'}
              </button>
              <span className="topbar__user">
                <span className="topbar__name">{user.name}</span>
                <span className="topbar__role">{ROLE_LABEL[user.role]}</span>
              </span>
              <button type="button" className="button button--quiet" onClick={signOut}>
                Sign out
              </button>
            </div>
          </header>
          {user.role === 'CUSTOMER' && <CustomerView key={user.id} api={api} user={user} />}
          {user.role === 'DRIVER' && <DriverView key={user.id} api={api} user={user} />}
          {user.role === 'DISPATCHER' && <DispatcherView key={user.id} api={api} />}
        </div>
      )}
      <ServerDialog api={api} open={serverOpen} onClose={() => setServerOpen(false)} />
    </ToastProvider>
  );
}

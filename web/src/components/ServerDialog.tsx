import { useEffect, useRef, useState } from 'react';
import type { WaypointApi } from '../api/client';
import { DemoApi } from '../api/demo/demoApi';
import { buildDefaultTarget, describeTarget, parseTarget, saveTargetOverride } from '../config';

interface ServerDialogProps {
  api: WaypointApi;
  open: boolean;
  onClose: () => void;
}

/** Lets a visitor point the page at a real Waypoint server, or go back to the in-browser demo. */
export function ServerDialog({ api, open, onClose }: ServerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<'demo' | 'server'>(api.mode === 'demo' ? 'demo' : 'server');
  const [url, setUrl] = useState(api.mode === 'live' ? api.target : '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const apply = (raw: string | null) => {
    saveTargetOverride(raw);
    window.location.reload();
  };

  const save = () => {
    if (choice === 'demo') {
      apply('demo');
      return;
    }
    const value = url.trim();
    if (value !== '/' && !/^https?:\/\/[^\s]+$/i.test(value)) {
      setError('Enter the full server address, like https://waypoint-api.onrender.com');
      return;
    }
    apply(value);
  };

  const buildDefault = describeTarget(buildDefaultTarget());

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="server-title">
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 id="server-title">Data source</h2>
        <p className="muted">
          Currently using <strong>{api.mode === 'demo' ? 'demo data stored in this browser' : api.target}</strong>.
        </p>

        <label className="choice">
          <input type="radio" name="source" checked={choice === 'demo'} onChange={() => setChoice('demo')} />
          <span>
            <strong>Demo</strong>
            <span className="muted">Runs entirely in your browser with simulated drivers. Nothing is sent anywhere.</span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="source" checked={choice === 'server'} onChange={() => setChoice('server')} />
          <span>
            <strong>Waypoint server</strong>
            <span className="muted">A running Waypoint backend. It must allow this page's address in CORS_ALLOWED_ORIGINS.</span>
          </span>
        </label>
        {choice === 'server' && (
          <label className="field">
            <span>Server address</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://waypoint-api.onrender.com"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
              autoFocus
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="dialog__actions">
          <button type="submit" className="button button--primary">
            Use this source
          </button>
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="dialog__footer">
          <button type="button" className="link-button" onClick={() => apply(null)}>
            Reset to this site's default ({parseTarget(buildDefault).kind === 'demo' ? 'demo' : buildDefault})
          </button>
          {api instanceof DemoApi && (
            <button
              type="button"
              className="link-button link-button--danger"
              onClick={() => {
                api.engine.reset();
                window.location.reload();
              }}
            >
              Erase demo data
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

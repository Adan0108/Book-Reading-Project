import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../../lib/axios';
import { message } from './images';

export default function AuthorGuard() {
  const [state, setState] = useState<'loading' | 'allowed' | 'failed'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState('loading');
    api.get('/authors/me/books', { params: { limit: 1 }, timeout: 30000 }).then(() => {
      if (active) setState('allowed');
    }).catch((e: unknown) => {
      if (active) {
        setError(isAxiosError(e) && e.response?.status === 403 ? 'An author account is required to publish books.' : message(e));
        setState('failed');
      }
    });
    return () => { active = false; };
  }, [attempt]);
  if (state === 'allowed') return <Outlet />;
  return <main className="max-w-2xl mx-auto p-8 pt-24">{state === 'loading' ? <p role="status">Checking author access…</p> : <>
    <p role="alert">{error}</p><Link to="/login" className="btn">Sign in</Link><button type="button" className="btn" onClick={() => setAttempt(a => a + 1)}>Retry</button>
  </>}</main>;
}

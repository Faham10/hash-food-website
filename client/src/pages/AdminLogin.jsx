import { motion } from 'framer-motion';
import { ArrowLeft, Flame, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, jsonBody } from '../lib/api.js';
import { useApp } from '../state/AppState.jsx';
import PageMotion from '../components/PageMotion.jsx';

export default function AdminLogin() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadyIn, setAlreadyIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    api('/api/admin/session')
      .then((session) => { if (mounted) setAlreadyIn(session.authenticated); })
      .catch(() => {})
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  });

  if (checking) return <div className="fullscreen-loader"><span className="loading-orbit" /></div>;
  if (alreadyIn) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/admin/login', { method: 'POST', body: jsonBody(form) });
      navigate('/admin', { replace: true });
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageMotion className="admin-login-page">
      <Link to="/" className="admin-login-back"><ArrowLeft size={16} /> Back to the storefront</Link>
      <div className="admin-login-card panel-glass">
        <div className="admin-login-brand"><span className="brand-mark"><Flame size={20} fill="currentColor" /></span><span className="brand-name">HASH<span>FOOD</span></span></div>
        <span className="eyebrow"><LockKeyhole size={14} /> PRIVATE ACCESS</span>
        <h1>THE CONTROL<br /><span>ROOM.</span></h1>
        <p>Keep the kitchen moving. Sign in to manage today's orders and your menu.</p>
        <form onSubmit={submit} className="admin-login-form">
          <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" required /></label>
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" required /></label>
          <motion.button whileTap={{ scale: 0.98 }} className="button button-primary button-large full-width" disabled={busy}>{busy ? 'Signing in…' : <>Sign in securely <LockKeyhole size={17} /></>}</motion.button>
        </form>
        <div className="login-security"><span className="secure-check"><LockKeyhole size={13} /></span> Protected by secure, private admin access.</div>
      </div>
    </PageMotion>
  );
}

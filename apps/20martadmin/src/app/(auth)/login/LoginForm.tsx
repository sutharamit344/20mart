'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? 'Sign-in failed. Please try again.');
        setPassword('');
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'w-full h-10 rounded-lg border border-line bg-surface-page pl-9 pr-3 text-sm text-ink placeholder:text-ink-400 focus:bg-surface focus:border-brand-green focus:ring-2 focus:ring-brand-green/10 focus:outline-none';

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft p-2.5 text-xs text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div>
        <label htmlFor="identifier" className="block text-2xs font-semibold text-ink-700 mb-1">
          Username or email
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            id="identifier"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="block text-2xs font-semibold text-ink-700 mb-1">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${field} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-600"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" variant="brand" size="md" isLoading={loading} disabled={!identifier || !password} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-2xs text-ink-400">
        Forgot your password? Ask a Super Admin to reset it.
      </p>
    </form>
  );
}

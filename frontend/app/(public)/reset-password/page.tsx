'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPasswordWithToken } from '@/lib/api/auth';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset link. Please request a new one.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid or missing reset link.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithToken(token, newPassword);
      if (!res.ok) {
        setError((res.data as any).detail || 'Error resetting password. The link may have expired.');
        return;
      }
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden py-4 px-4">
      {/* Ambient glow */}
      <div className="fixed -top-[20%] -left-[10%] w-[65%] h-[65%] pointer-events-none -z-10" style={{ background: 'radial-gradient(ellipse, hsla(258, 80%, 50%, 0.14) 0%, transparent 70%)' }} />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[18.75rem_1fr] w-full max-w-[50rem] rounded-xl border border-border shadow-lg animate-fade-in mx-auto overflow-hidden">
        {/* Left Panel */}
        <div className="relative flex flex-col items-center justify-center py-10 px-7 overflow-hidden bg-gradient-to-br from-[hsl(270,60%,18%)] via-[hsl(258,70%,34%)] to-[hsl(280,55%,20%)]">
          {/* Animated mesh */}
          <div className="absolute inset-0 animate-pulse opacity-30" style={{ background: 'radial-gradient(ellipse at 20% 20%, hsla(320, 60%, 50%, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, hsla(220, 70%, 50%, 0.2) 0%, transparent 50%)' }} />
          <div className="relative z-[1] text-center text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image
              src="/images/tati_logo.jpg"
              alt="Teacher Tati"
              width={104}
              height={104}
              priority
              className="rounded-full object-cover object-top border-[3px] border-white/30 shadow-[0_0_40px_rgba(0,0,0,0.3),0_0_0_8px_rgba(255,255,255,0.06)] mb-5 mx-auto"
            />
            <h1 className="font-display text-2xl font-extrabold mb-2 tracking-tight">Teacher Tati</h1>
            <p className="text-[0.83rem] opacity-75 max-w-[13rem] leading-relaxed mx-auto">Your AI English teacher. Practice whenever you want, at your own pace.</p>
            <div className="flex gap-1.5 mt-7 justify-center">
              <span className="w-[1.125rem] h-[0.4375rem] rounded bg-white/80" />
              <span className="w-[0.4375rem] h-[0.4375rem] rounded-full bg-white/30" />
              <span className="w-[0.4375rem] h-[0.4375rem] rounded-full bg-white/30" />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex items-center justify-center p-6 md:p-9 bg-surface">
          <div className="w-full max-w-[20rem]">
            <h2 className="font-display text-[1.4rem] font-extrabold tracking-tight mb-1">
              Reset Password
            </h2>
            <p className="text-text-muted text-[0.83rem] mb-6">
              {token
                ? 'Enter your new password below.'
                : 'This reset link is invalid or has expired.'}
            </p>

            {/* Error/Success messages */}
            {error && (
              <div className="mb-4 bg-danger/10 border border-danger/30 text-danger px-3.5 py-2 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 bg-success/10 border border-success/30 text-success px-3.5 py-2 rounded-md text-sm">
                {success}
              </div>
            )}

            {!token ? (
              <Button onClick={() => router.push('/login')} fullWidth>
                Back to Login
              </Button>
            ) : (
              <form onSubmit={handleSubmit}>
                <Input
                  label="New Password"
                  type="password"
                  placeholder="New password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button type="submit" fullWidth loading={loading}>
                  Reset Password
                </Button>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-primary text-[0.78rem] font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

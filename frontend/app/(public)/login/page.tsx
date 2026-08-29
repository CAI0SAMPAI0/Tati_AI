'use client';

import Image from 'next/image';
import Script from 'next/script';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { loginWithCredentials, loginWithGoogle, registerUser, requestPasswordReset, resetPasswordWithToken } from '@/lib/api/auth';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';
import { Capacitor } from '@capacitor/core';


type Tab = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { saveSession } = useAuth();

  const router = useRouter();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Login state
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLevel, setRegLevel] = useState('A1');

  // Forgot state
  const [forgotId, setForgotId] = useState('');
  const [forgotResult, setForgotResult] = useState<{ type: string; html: string } | null>(null);

  const clearMessages = () => { setError(''); setSuccess(''); setForgotResult(null); };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    clearMessages();
  };

  // Handle Google OAuth and Token query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const isHub = params.get('access') === 'hub';

    if (token) {
      let userObj: any = null;
      try {
        if (userParam) userObj = JSON.parse(decodeURIComponent(userParam));
      } catch (_) {}

      // Limpa os parâmetros da URL
      window.history.replaceState({}, '', window.location.pathname);

      saveSession(token, userObj || { username: 'student' }).then(() => {
        if (isHub || userObj?.is_hub_only) {
          window.location.href = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
        } else {
          router.replace('/chat');
        }
      });
      return;
    }

    const credential = params.get('credential');
    if (credential) {
      handleGoogleCredential({ credential });
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSession, router]);

  // Google OAuth
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGoogle = (retries = 0) => {
      if (typeof window === 'undefined') return;
      const g = (window as any).google;
      if (!g?.accounts?.id) {
        if (retries < 30) setTimeout(() => initGoogle(retries + 1), 500);
        return;
      }

      g.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
      });

      if (googleBtnRef.current) {
        g.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'filled_black',
          text: 'continue_with',
          size: 'large',
          width: googleBtnRef.current.clientWidth || 320,
        });
      }
    };

    if ((window as any).google?.accounts?.id) {
      initGoogle();
    } else {
      initGoogle();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    clearMessages();
    setLoading(true);
    try {
      const res = await loginWithGoogle(response.credential);
      if (!res.ok) {
        setError((res.data as any)?.detail || 'Error authenticating with Google.');
        return;
      }
      await saveSession(res.data.access_token, res.data.user);
      const user = res.data.user as any;
      if (isHubAccess || user.is_hub_only) {
        window.location.href = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
      } else {
        router.push('/chat');
      }
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHubAccess = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'hub';

  const handleGoogleLogin = useCallback(() => {
    clearMessages();
    setLoading(true);
    setError('');

    // Redireciona diretamente para o fluxo de autenticação do Google (302 Redirect)
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://caio007-tati-ai-backend.hf.space';
    window.location.href = `${apiBase}/auth/google/login`;
  }, []);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!loginId || !loginPw) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await loginWithCredentials(loginId, loginPw);
      if (!res.ok) { setError((res.data as any).detail || 'Invalid credentials.'); return; }
      await saveSession(res.data.access_token, res.data.user);

      const user = res.data.user as any;
      if (isHubAccess || user.is_hub_only) {
        // Redireciona para o novo Hub na porta 3001
        window.location.href = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
      } else {
        router.push('/chat');
      }
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!regName || !regEmail || !regUsername || !regPassword) { setError('Please fill in all fields.'); return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await registerUser({
        name: regName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
        level: regLevel,
        is_hub_only: isHubAccess
      });
      if (!res.ok) { setError((res.data as any).detail || 'Error creating account.'); return; }

      // Faz login automático na hora e entra direto no chat!
      const loginRes = await loginWithCredentials(regUsername, regPassword);
      if (loginRes.ok) {
        await saveSession(loginRes.data.access_token, loginRes.data.user);
        router.push('/chat');
        return;
      }

      setSuccess('Account created! Sign in now.');
      setTimeout(() => switchTab('login'), 1500);
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
  const [resetToken, setResetToken] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetConfirmPw, setResetConfirmPw] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!forgotId) { setError('Please enter your username or email.'); return; }
    setLoading(true);
    try {
      const res = await requestPasswordReset(forgotId);
      if (!res.ok) { setError((res.data as any).detail || 'Error requesting password reset.'); return; }
      const data = res.data as any;
      if (data.reset_token) {
        setResetToken(data.reset_token);
        setForgotResult({ type: 'success', html: 'Enter your new password below.' });
        setActiveTab('reset');
      } else {
        setForgotResult({ type: 'success', html: data.message || 'Check your email for the reset link.' });
      }
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!resetToken) { setError('No reset token.'); return; }
    if (resetPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (resetPw !== resetConfirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await resetPasswordWithToken(resetToken, resetPw);
      if (!res.ok) { setError((res.data as any).detail || 'Error resetting password.'); return; }
      setResetDone(true);
      setForgotResult({ type: 'success', html: 'Password reset successfully! Redirecting to login...' });
      setTimeout(() => { switchTab('login'); setResetDone(false); setResetToken(''); setResetPw(''); setResetConfirmPw(''); }, 2000);
    } catch {
      setError('Connection error. Check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const levelOptions = LEVEL_OPTIONS;

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden py-4 px-4">
      {/* Script from Next.js to load Google Identity Services */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

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
            <p className="text-[0.83rem] opacity-75 max-w-[13rem] leading-relaxed mx-auto">{'Your AI English teacher. Practice whenever you want, at your own pace.'}</p>
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
              {isHubAccess ? 'Join Premium Hub' : 'Welcome'}
            </h2>
            <p className="text-text-muted text-[0.83rem] mb-6">
              {isHubAccess
                ? 'Create an account to access exclusive materials and downloads.'
                : 'Sign in or create a new account'}
            </p>

            {/* Tabs */}
            {activeTab !== 'forgot' && (
              <div className="flex bg-bg-secondary rounded-md p-[3px] mb-6 border border-border">
                <button
                  onClick={() => switchTab('login')}
                  className={`flex-1 py-2 text-[0.855rem] font-semibold rounded-[calc(0.625rem-2px)] transition-all duration-base ${activeTab === 'login' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                >
                  {'Sign in'}
                </button>
                <button
                  onClick={() => switchTab('register')}
                  className={`flex-1 py-2 text-[0.855rem] font-semibold rounded-[calc(0.625rem-2px)] transition-all duration-base ${activeTab === 'register' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                >
                  {'Create Account'}
                </button>
              </div>
            )}

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

            {/* Google button */}
            {activeTab !== 'forgot' && (
              <>
                <div className="relative w-full mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full py-2.5 bg-input text-text border border-border rounded-[9px] text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-bg-secondary transition-colors cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>{'Continue with Google'}</span>
                  </button>
                  <div ref={googleBtnRef} className="hidden pointer-events-none" />
                </div>
                <div className="flex items-center gap-3 mb-4 text-text-subtle text-[0.73rem] tracking-wider">
                  <span className="flex-1 h-px bg-border" />
                  <span>{'or'}</span>
                  <span className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                <Input
                  label={'Username or Email'}
                  placeholder={'Username or Email'}
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
                <Input
                  label={'Password'}
                  type="password"
                  placeholder={'Password'}
                  autoComplete="current-password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                />
                <div className="text-right -mt-2 mb-3">
                  <button type="button" onClick={() => switchTab('forgot')} className="text-primary text-[0.78rem] font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity">
                    {'I forgot my password'}
                  </button>
                </div>
                <Button type="submit" fullWidth loading={loading}>
                  {'Sign in'}
                </Button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister}>
                <Input label={'Full name'} placeholder={'Full name'} value={regName} onChange={(e) => setRegName(e.target.value)} />
                <Input label={'Email'} type="email" placeholder={'Email'} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                <Input label={'Username'} placeholder={'Username'} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
                <Input label={'Password'} type="password" placeholder={'Password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                <Select label={'English level'} value={regLevel} onChange={(e) => setRegLevel(e.target.value)} options={levelOptions} />
                <Button type="submit" fullWidth loading={loading}>
                  {'Create Account'}
                </Button>
              </form>
            )}

            {/* Forgot Password Form */}
            {activeTab === 'forgot' && (
              <form onSubmit={handleForgot}>
                <button type="button" onClick={() => switchTab('login')} className="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-5 hover:text-primary transition-colors">
                  {'← Back to login'}
                </button>
                <p className="text-base font-bold text-text mb-1">{'🔒 Forgot my password'}</p>
                <p className="text-[0.82rem] text-text-muted mb-5 leading-relaxed">{'Enter your username or email.'}</p>
                <Input label={'Username or Email'} placeholder={'Username or Email'} autoComplete="username" value={forgotId} onChange={(e) => setForgotId(e.target.value)} />
                <Button type="submit" fullWidth loading={loading}>
                  {'Reset your password'}
                </Button>
                {forgotResult && (
                  <div className={`mt-4 p-3.5 rounded-md text-[0.83rem] leading-relaxed ${forgotResult.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : 'bg-danger/10 border border-danger/30 text-danger'}`}>
                    {forgotResult.html}
                  </div>
                )}
              </form>
            )}

            {/* Reset Password Form (in-app) */}
            {activeTab === 'reset' && (
              <form onSubmit={handleResetSubmit}>
                <button type="button" onClick={() => switchTab('forgot')} className="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-5 hover:text-primary transition-colors">
                  {'← Back'}
                </button>
                <p className="text-base font-bold text-text mb-1">{'🔐 Reset your password'}</p>
                <p className="text-[0.82rem] text-text-muted mb-5 leading-relaxed">{'Choose your new password.'}</p>
                <Input label={'New Password'} type="password" placeholder={'At least 6 characters'} value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                <Input label={'Confirm Password'} type="password" placeholder={'Repeat your new password'} value={resetConfirmPw} onChange={(e) => setResetConfirmPw(e.target.value)} />
                <Button type="submit" fullWidth loading={loading}>
                  {'Reset Password'}
                </Button>
                {forgotResult && (
                  <div className={`mt-4 p-3.5 rounded-md text-[0.83rem] leading-relaxed ${forgotResult.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : 'bg-danger/10 border border-danger/30 text-danger'}`}>
                    {forgotResult.html}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

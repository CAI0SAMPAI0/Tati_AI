'use client';

import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Bug, ArrowLeft, User, Lock, Eye, EyeOff } from 'lucide-react';
import { DeveloperBugModal } from '@/components/feedback/developer-bug-modal';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { loginWithCredentials, loginWithGoogle, registerUser, requestPasswordReset, resetPasswordWithToken } from '@/lib/api/auth';
import { API_BASE } from '@/lib/api/client';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';

type Tab = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { saveSession } = useAuth();

  const router = useRouter();

  // Login state
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLevel, setRegLevel] = useState('A1');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);

  // Forgot state
  const [forgotId, setForgotId] = useState('');
  const [forgotResult, setForgotResult] = useState<{ type: string; html: string } | null>(null);

  const clearMessages = () => { setError(''); setSuccess(''); setForgotResult(null); };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    clearMessages();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGoogleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
        const isHub = new URLSearchParams(window.location.search).get('access') === 'hub';
        saveSession(
          event.data.token,
          event.data.user || { username: 'student' },
          event.data.refreshToken || event.data.refresh_token
        )
          .then((savedUser) => {
            if (isHub || event.data.user?.is_hub_only || (savedUser as any)?.is_hub_only) {
              window.location.href = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
            } else {
              router.replace('/chat');
            }
          })
          .catch((err) => {
            console.error('[Login] Google message saveSession error:', err);
            setError('Erro ao salvar sessão.');
          });
      }
    };
    window.addEventListener('message', handleGoogleMessage);

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');
    const userParam = params.get('user');
    const isHub = params.get('access') === 'hub';

    if (token) {
      let userObj: any = null;
      try {
        if (userParam) {
          try {
            userObj = JSON.parse(userParam);
          } catch {
            userObj = JSON.parse(decodeURIComponent(userParam));
          }
        }
      } catch (_) { }

      window.history.replaceState({}, '', window.location.pathname);

      saveSession(token, userObj || { username: 'student' }, refreshToken)
        .then((savedUser) => {
          if (isHub || userObj?.is_hub_only || (savedUser as any)?.is_hub_only) {
            window.location.href = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
          } else {
            router.replace('/chat');
          }
        })
        .catch((err) => {
          console.error('[Login] URL token saveSession error:', err);
          setError('Erro ao validar sessão. Faça login novamente.');
        });
      return () => window.removeEventListener('message', handleGoogleMessage);
    }

    const credential = params.get('credential');
    if (credential) {
      handleGoogleCredential({ credential }).catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => window.removeEventListener('message', handleGoogleMessage);
  }, [saveSession, router]);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    clearMessages();
    setLoading(true);
    try {
      const res = await loginWithGoogle(response.credential);
      if (!res.ok) {
        setError((res.data as any)?.detail || 'Error authenticating with Google.');
        return;
      }
      await saveSession(res.data.access_token, res.data.user, res.data.refresh_token);
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
  }, [saveSession, router]);

  const isHubAccess = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'hub';

  const handleGoogleLogin = useCallback(() => {
    clearMessages();
    setLoading(true);
    setError('');

    if (typeof window !== 'undefined') {
      const isFlutter = (window as any).isFlutterApp || (window as any).flutter_inappwebview;
      if (isFlutter && (window as any).flutter_inappwebview?.callHandler) {
        (window as any).flutter_inappwebview
          .callHandler('googleLogin')
          .then(async (res: any) => {
            try {
              if (res && res.token && res.user) {
                await saveSession(res.token, res.user, res.refreshToken || res.refresh_token);
                router.push('/chat');
              } else if (res && res.success) {
                router.push('/chat');
              } else {
                setLoading(false);
              }
            } catch (sessionErr) {
              console.error('[Login] Flutter google session error:', sessionErr);
              setLoading(false);
              setError('Erro ao salvar sessão.');
            }
          })
          .catch(() => {
            setLoading(false);
          });
        return;
      }
    }

    const base = API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    const isHub = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'hub';
    const hubParam = isHub ? '&access=hub' : '';
    const targetUrl = `${base.replace(/\/+$/, '')}/auth/google/login?origin=${origin}${hubParam}`;
    window.location.href = targetUrl;
  }, [saveSession, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!loginId || !loginPw) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await loginWithCredentials(loginId, loginPw);
      if (!res.ok) { setError((res.data as any).detail || 'Invalid credentials.'); return; }
      await saveSession(res.data.access_token, res.data.user, res.data.refresh_token);

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
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!regName || !regEmail || !regUsername || !regPassword) { setError('Please fill in all fields.'); return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!acceptedTerms) {
      setError('É obrigatório aceitar os Termos de Uso e Política de Privacidade (LGPD).');
      return;
    }
    if (!parentalConsent) {
      setError('Por favor, confirme a declaração de maioridade ou autorização dos pais/responsáveis (Art. 14 da LGPD).');
      return;
    }
    setLoading(true);
    try {
      const res = await registerUser({
        name: regName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
        level: regLevel,
        is_hub_only: isHubAccess,
        accepted_terms: acceptedTerms,
        parental_consent: parentalConsent,
      });
      if (!res.ok) { setError((res.data as any).detail || 'Error creating account.'); return; }

      const loginRes = await loginWithCredentials(regUsername, regPassword);
      if (loginRes.ok) {
        await saveSession(loginRes.data.access_token, loginRes.data.user, loginRes.data.refresh_token);
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
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-bg relative overflow-y-auto py-6 px-4 sm:px-6">
      <div className="relative z-10 w-full max-w-[28.125rem] flex flex-col items-center my-auto">
        
        {/* Voltar para a página inicial */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors mb-6 group self-start sm:self-center">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar para a página inicial</span>
        </Link>

        {/* Logo / Header com os textos originais */}
        <div className="text-center mb-6 w-full">
          <Image
            src="/images/tati_logo.jpg"
            alt="Taty's Hub"
            width={72}
            height={72}
            priority
            className="rounded-full object-cover object-top border-[3px] border-border shadow-[0_4px_16px_rgba(0,0,0,0.1)] mb-3 mx-auto"
          />
          <h1 className="font-display text-2xl font-extrabold text-text tracking-tight mb-1">Taty's Hub</h1>
          <p className="text-[0.83rem] text-text-muted max-w-[17.5rem] leading-relaxed mx-auto">Your AI English teacher. Practice whenever you want, at your own pace.</p>
        </div>

        {/* Tabs - Sign in / Create Account */}
        {activeTab !== 'forgot' && activeTab !== 'reset' && (
          <div className="flex bg-bg-secondary rounded-full p-[4px] mb-5 w-full max-w-[23.75rem] border border-border shadow-sm">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-base ${activeTab === 'login' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-base ${activeTab === 'register' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Formulário Card Responsivo com fontes nativas do sistema */}
        <div className="w-full bg-surface rounded-[24px] border border-border shadow-lg p-6 sm:p-7.5">
          {error && (
            <div className="mb-4 bg-danger/10 border border-danger/30 text-danger px-4 py-2.5 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-success/10 border border-success/30 text-success px-4 py-2.5 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}

          {/* Social Google OAuth Button */}
          {activeTab !== 'forgot' && activeTab !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 bg-input text-text border border-border rounded-full text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-bg-secondary transition-colors cursor-pointer shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-4 text-text-subtle text-[0.73rem] tracking-wider">
                <span className="flex-1 h-px bg-border" />
                <span>or</span>
                <span className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                  I forgot my password
                </button>
              </div>
              <Button type="submit" fullWidth loading={loading}>
                Sign in
              </Button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input label={'Full name'} placeholder={'Full name'} value={regName} onChange={(e) => setRegName(e.target.value)} />
              <Input label={'Email'} type="email" placeholder={'Email'} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              <Input label={'Username'} placeholder={'Username'} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
              <Input label={'Password'} type="password" placeholder={'Password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
              <Select label={'English level'} value={regLevel} onChange={(e) => setRegLevel(e.target.value)} options={levelOptions} />

              <div className="space-y-3 my-4 p-3.5 rounded-xl bg-bg-secondary/40 border border-border/80 text-left">
                <label className="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                  <span>
                    Li e aceito os{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-bold underline hover:opacity-80 inline-flex items-center gap-0.5"
                    >
                      Termos de Uso e Política de Privacidade (LGPD)
                    </a>.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={parentalConsent}
                    onChange={(e) => setParentalConsent(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                  <span>
                    Declaro que sou maior de 18 anos ou possuo autorização expressa dos pais/responsáveis legais (Art. 14 da LGPD).
                  </span>
                </label>
              </div>

              <Button type="submit" fullWidth loading={loading} disabled={!acceptedTerms || !parentalConsent}>
                Create Account
              </Button>
            </form>
          )}

          {/* Forgot Password Form */}
          {activeTab === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <button type="button" onClick={() => switchTab('login')} className="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors">
                ← Back to login
              </button>
              <p className="text-base font-bold text-text mb-1">Forgot my password</p>
              <p className="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Enter your username or email.</p>
              <Input label={'Username or Email'} placeholder={'Username or Email'} autoComplete="username" value={forgotId} onChange={(e) => setForgotId(e.target.value)} />
              <Button type="submit" fullWidth loading={loading}>
                Reset your password
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
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <button type="button" onClick={() => switchTab('forgot')} className="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors">
                ← Back
              </button>
              <p className="text-base font-bold text-text mb-1">🔐 Reset your password</p>
              <p className="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Choose your new password.</p>
              <Input label={'New Password'} type="password" placeholder={'At least 6 characters'} value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
              <Input label={'Confirm Password'} type="password" placeholder={'Repeat your new password'} value={resetConfirmPw} onChange={(e) => setResetConfirmPw(e.target.value)} />
              <Button type="submit" fullWidth loading={loading}>
                Reset Password
              </Button>
              {forgotResult && (
                <div className={`mt-4 p-3.5 rounded-md text-[0.83rem] leading-relaxed ${forgotResult.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : 'bg-danger/10 border border-danger/30 text-danger'}`}>
                  {forgotResult.html}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Rodapé - Suporte Técnico e Feedback */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center w-full">
          <button
            type="button"
            onClick={() => setShowBugModal(true)}
            className="inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-red-500 transition-colors py-1 cursor-pointer font-medium"
          >
            <Bug size={14} className="text-red-400" />
            <span>Problemas para acessar? <strong className="underline underline-offset-2">Reportar Bug ao Desenvolvedor</strong></span>
          </button>

          <Link
            href="/atualizar"
            className="inline-flex items-center justify-center gap-1 text-[0.76rem] text-primary/80 hover:text-primary hover:underline transition-colors"
          >
            <span>Baixar ou Atualizar Aplicativo Android (APK)</span>
          </Link>
        </div>

        {/* Modal para Reports de Bug do Sistema */}
        <DeveloperBugModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
      </div>
    </main>
  );
}
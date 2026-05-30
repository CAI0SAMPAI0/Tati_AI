'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  loginWithCredentials,
  loginWithGoogle,
  registerUser,
} from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';

type AuthTab = 'login' | 'register';

type GoogleCredentialResponse = {
  credential: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, saveSession } = useHubAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<AuthTab>(
    searchParams.get('tab') === 'register' ? 'register' : 'login',
  );
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerLevel, setRegisterLevel] = useState('Beginner');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      router.replace('/materiais');
    }
  }, [router, user]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;

    const initGoogle = (retries = 0) => {
      if (cancelled) return;

      const google = (window as typeof window & {
        google?: {
          accounts?: {
            id?: {
              initialize: (config: Record<string, unknown>) => void;
              renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
            };
          };
        };
      }).google;

      if (!google?.accounts?.id) {
        if (retries < 15) {
          window.setTimeout(() => initGoogle(retries + 1), 500);
        }
        return;
      }

      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
      });

      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'filled_black',
          text: 'continue_with',
          size: 'large',
          width: googleBtnRef.current.clientWidth || 320,
        });
      }
    };

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogle();
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
    };
  }, []);

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function handleAuthSuccess(accessToken: string, nextUser: Parameters<typeof saveSession>[1]) {
    saveSession(accessToken, nextUser);
    router.push('/materiais');
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    clearMessages();
    setLoading(true);

    try {
      const result = await loginWithGoogle(response.credential, true);
      handleAuthSuccess(result.data.access_token, result.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel autenticar com Google.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!identifier || !password) {
      setError('Preencha usuário/e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const response = await loginWithCredentials(identifier, password);
      handleAuthSuccess(response.data.access_token, response.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possivel autenticar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!registerName || !registerEmail || !registerUsername || !registerPassword) {
      setError('Preencha todos os campos para criar sua conta.');
      return;
    }

    if (registerPassword.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        name: registerName,
        email: registerEmail,
        username: registerUsername,
        password: registerPassword,
        level: registerLevel,
        is_hub_only: true,
      });

      setSuccess('Conta criada. Agora você já pode entrar no hub.');
      setActiveTab('login');
      setIdentifier(registerEmail);
      setPassword(registerPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possivel criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-6xl">
        <div className="grid overflow-hidden rounded-hub border border-line bg-surface shadow-card md:grid-cols-[1fr_1fr]">

          {/* LEFT */}
          <section className="relative hidden overflow-hidden border-r border-line bg-primarySoft px-11 py-14 md:flex md:flex-col md:justify-center">
            <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-primarySoft blur-3xl" />

            <div className="relative z-10">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Tati Hub Premium
              </p>

              <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight text-ink">
                Entre ou crie sua conta Tati AI.
              </h1>

              <p className="mb-7 text-sm leading-7 text-ink0">
                Quem já tem acesso à Tati AI usa a mesma conta. Quem ainda não tem
                acesso pode criar agora ou entrar com Google.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  'Materiais personalizados',
                  'E-books exclusivos',
                  'Exercícios comentados',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-line px-4 py-1.5 text-xs text-ink0"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="flex max-h-screen flex-col overflow-y-auto px-6 py-10 md:px-9">
            <Link
              href="/materiais"
              className="mb-7 inline-flex items-center gap-1.5 text-sm text-ink0 transition hover:text-zinc-200"
            >
              <ArrowLeft size={15} />
              Voltar ao catálogo
            </Link>

            <div className="mb-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primarySoft text-primary">
                <BrandMark variant="compact" />
              </div>

              <h2 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
                {activeTab === 'login' ? 'Entrar no hub' : 'Criar conta'}
              </h2>

              <p className="text-sm leading-6 text-muted">
                {activeTab === 'login'
                  ? 'Use sua conta da Tati AI ou entre com Google.'
                  : 'Crie uma conta para comprar e acessar materiais do Hub Premium.'}
              </p>
            </div>

            {/* Tabs */}
            <div className="mb-5 flex rounded-xl border border-line bg-bgSecondary p-1">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setActiveTab('login');
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'login'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-ink'
                  }`}
              >
                Entrar
              </button>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setActiveTab('register');
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'register'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-ink'
                  }`}
              >
                Criar conta
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {success}
              </div>
            )}

            {/* GOOGLE */}
            <div className="mb-4 flex w-full justify-center">
              <div ref={googleBtnRef} className="w-full flex justify-center" />
            </div>

            <div className="mb-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-600">
                ou
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* LOGIN */}
            {activeTab === 'login' ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    Usuário ou e-mail
                  </span>

                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-xl border border-line bg-bgSecondary px-4 py-3 text-sm text-ink outline-none transition focus:border-violet-500/50"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    Senha
                  </span>

                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      className="w-full rounded-xl border border-line bg-bgSecondary py-3 pl-4 pr-12 text-sm text-ink outline-none transition focus:border-violet-500/50"
                    />

                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-ink0 transition hover:text-zinc-300"
                    >
                      {showLoginPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Entrando...' : 'Entrar no hub'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    Nome completo
                  </span>

                  <input
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-xl border border-line bg-bgSecondary px-4 py-3 text-sm text-ink outline-none transition focus:border-violet-500/50"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    E-mail
                  </span>

                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-xl border border-line bg-bgSecondary px-4 py-3 text-sm text-ink outline-none transition focus:border-violet-500/50"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    Usuário
                  </span>

                  <input
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    placeholder="seuusuario"
                    className="w-full rounded-xl border border-line bg-bgSecondary px-4 py-3 text-sm text-ink outline-none transition focus:border-violet-500/50"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted">
                    Senha
                  </span>

                  <div className="relative">
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      className="w-full rounded-xl border border-line bg-bgSecondary py-3 pl-4 pr-12 text-sm text-ink outline-none transition focus:border-violet-500/50"
                    />

                    <button
                      type="button"
                      aria-label={
                        showRegisterPassword
                          ? 'Ocultar senha'
                          : 'Mostrar senha'
                      }
                      onClick={() => setShowRegisterPassword((v) => !v)}
                      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-ink0 transition hover:text-zinc-300"
                    >
                      {showRegisterPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Criando conta...' : 'Criar conta'}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
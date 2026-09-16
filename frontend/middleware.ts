import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_TOKEN_COOKIE = 'auth_token';

// Rotas públicas acessíveis sem autenticação
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/reset-password',
  '/privacy',
  '/politica-de-privacidade',
  '/teste-cefr',
  '/cefr-test',
  '/hub',
];

// Rotas de autenticação que devem redirecionar para /chat caso o usuário já esteja logado
const authOnlyWhenGuestRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora arquivos internos do Next.js e arquivos estáticos
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/downloads/') ||
    pathname.startsWith('/google') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    /\.(html|xml|txt|json|png|jpg|jpeg|svg|ico|webp|pdf)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(route + '/'))
  );

  // Se o usuário está logado e acessa /login ou /register, redireciona para /chat
  const isAuthGuestRoute = authOnlyWhenGuestRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  const isResetWithToken = pathname === '/reset-password' && request.nextUrl.searchParams.has('token');

  if (token && isAuthGuestRoute && !isResetWithToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    if (url.searchParams.has('_v')) url.searchParams.delete('_v');
    return NextResponse.redirect(url);
  }

  // Se o usuário está logado e acessa a raiz (/), redireciona sempre direto para /chat
  if (token && pathname === '/') {
    const targetUrl = new URL('/chat', request.url);
    if (targetUrl.searchParams.has('_v')) targetUrl.searchParams.delete('_v');
    return NextResponse.redirect(targetUrl);
  }

  // Se estiver em modo PWA ou APK e acessar a raiz (/), nunca exibe a landing page
  const isPwaOrApk =
    Boolean(request.headers.get('x-requested-with')) ||
    request.cookies.get('is_pwa')?.value === '1' ||
    request.nextUrl.searchParams.get('mode') === 'standalone' ||
    request.nextUrl.searchParams.get('source') === 'pwa' ||
    request.nextUrl.searchParams.has('apk');

  if (isPwaOrApk && pathname === '/') {
    const targetUrl = new URL(token ? '/chat' : '/login', request.url);
    if (targetUrl.searchParams.has('_v')) targetUrl.searchParams.delete('_v');
    return NextResponse.redirect(targetUrl);
  }

  // Se não estiver logado e não for rota pública, redireciona para /login
  if (!token && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|images/|icons/|downloads/|sw\\.js|manifest\\.json).*)',
  ],
};

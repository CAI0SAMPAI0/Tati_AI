import type { Metadata } from 'next';
import LandingClient from './landing-client';

export const metadata: Metadata = {
  title: 'Teacher Tati AI | Aprenda Inglês com Inteligência Artificial Humanizada',
  description:
    'Pratique conversação em inglês 24/7 com a Teacher Tati AI. Teste seu nível CEFR gratuitamente no chat, receba correções imediatas e acelere sua fluência.',
  openGraph: {
    title: 'Teacher Tati AI | Plataforma Inteligente de Inglês',
    description: 'Faça o teste de nivelamento CEFR gratuito e pratique conversação 24/7.',
    url: 'https://tati-ai.vercel.app',
    siteName: 'Teacher Tati AI',
    locale: 'pt_BR',
    type: 'website',
  },
  verification: {
    google: '2pUtbPwWrV8Q1kdAj8fmkYUIY7a-BI0NRj_WKjAHoLM',
  },
};

export default function HomePage() {
  return <LandingClient />;
}

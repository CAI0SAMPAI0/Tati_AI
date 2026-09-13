import { redirect } from 'next/navigation';

// Producao ativa no commit 5d37072 (removendo um elemento nao funcional)
export default function Home() {
  redirect('/login');
}

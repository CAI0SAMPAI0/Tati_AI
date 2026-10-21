/**
 * One-time migration helper: splits client page.tsx into *-client-page.tsx + server page.tsx
 * Run from frontend/: node scripts/migrate-ssr-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const migrations = [
  { page: 'app/(authenticated)/competitions/page.tsx', client: 'competitions-client-page.tsx', route: 'competitions', fn: 'CompetitionsClientPage' },
  { page: 'app/(authenticated)/payment/page.tsx', client: 'payment-client-page.tsx', route: 'payment', fn: 'PaymentClientPage' },
  { page: 'app/(authenticated)/podcasts/page.tsx', client: 'podcasts-client-page.tsx', route: 'podcasts', fn: 'PodcastsClientPage' },
  { page: 'app/(authenticated)/goals/page.tsx', client: 'goals-client-page.tsx', route: 'goals', fn: 'GoalsClientPage', rename: ['GoalsPage', 'GoalsClientPage'] },
  { page: 'app/(authenticated)/profile/page.tsx', client: 'profile-client-page.tsx', route: 'profile', fn: 'ProfileClientPage', rename: ['ProfilePage', 'ProfileClientPage'] },
  { page: 'app/(authenticated)/progress/page.tsx', client: 'progress-client-page.tsx', route: 'progress', fn: 'ProgressClientPage', rename: ['ProgressPage', 'ProgressClientPage'] },
  { page: 'app/(authenticated)/receipt/page.tsx', client: 'receipt-client-page.tsx', route: 'receipt', fn: 'ReceiptClientPage', rename: ['ReceiptPage', 'ReceiptClientPage'] },
  { page: 'app/(authenticated)/vocab/page.tsx', client: 'vocab-client-page.tsx', route: 'vocab', fn: 'VocabClientPage', rename: ['VocabPage', 'VocabClientPage'] },
  { page: 'app/(authenticated)/vocab/review/page.tsx', client: 'vocab-review-client-page.tsx', route: 'vocab-review', fn: 'VocabReviewClientPage', rename: ['SRSReviewPage', 'VocabReviewClientPage'] },
  { page: 'app/(authenticated)/chat/page.tsx', client: 'chat-client-page.tsx', route: 'chat', fn: 'ChatClientPage', rename: ['ChatPage', 'ChatClientPage'], suspense: true },
  { page: 'app/(authenticated)/dashboard/page.tsx', client: 'dashboard-client-page.tsx', route: 'dashboard', fn: 'DashboardClientPage', rename: ['DashboardPage', 'DashboardClientPage'], suspense: true },
  { page: 'app/(authenticated)/activities/hub/page.tsx', client: 'hub-client-page.tsx', route: 'hub-catalog', fn: 'HubClientPage' },
  { page: 'app/(authenticated)/activities/hub/pedidos/page.tsx', client: 'pedidos-client-page.tsx', route: 'hub-orders', fn: 'PedidosClientPage' },
  { page: 'app/(authenticated)/activities/hub/meus-materiais/page.tsx', client: 'meus-materiais-client-page.tsx', route: 'hub-my-materials', fn: 'MyMaterialsClientPage', rename: ['MyMaterialsClientPage', 'MyMaterialsClientPage'] },
  { page: 'app/(authenticated)/quiz/[id]/page.tsx', client: 'quiz-client-page.tsx', route: 'quiz', fn: 'QuizClientPage', rename: ['QuizPage', 'QuizClientPage'], dynamic: true },
  { page: 'app/(authenticated)/flashcards/[id]/page.tsx', client: 'flashcards-client-page.tsx', route: 'flashcards', fn: 'FlashcardsClientPage', rename: ['FlashcardDeckPage', 'FlashcardsClientPage'], dynamic: true },
  { page: 'app/(authenticated)/podcasts/[id]/page.tsx', client: 'podcast-detail-client-page.tsx', route: 'podcast', fn: 'PodcastDetailClientPage', rename: ['PodcastDetailPage', 'PodcastDetailClientPage'], dynamic: true },
];

for (const m of migrations) {
  const pagePath = path.join(root, m.page);
  const dir = path.dirname(pagePath);
  const clientPath = path.join(dir, m.client);

  if (!fs.existsSync(pagePath)) {
    console.log('SKIP missing', m.page);
    continue;
  }
  if (fs.existsSync(clientPath)) {
    console.log('SKIP exists', m.client);
    continue;
  }

  let content = fs.readFileSync(pagePath, 'utf8');
  if (m.rename) {
    content = content.replace(`export default function ${m.rename[0]}`, `export default function ${m.rename[1]}`);
  }
  fs.writeFileSync(clientPath, content);

  const importName = m.client.replace('.tsx', '').split('/').pop().replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
  const clientImport = `./${m.client.replace('.tsx', '')}`;

  let serverPage;
  if (m.dynamic) {
    serverPage = `import { Suspense } from 'react';
import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import { Spinner } from '@/components/ui/spinner';
import ${m.fn} from '${clientImport}';

export default async function Page({ params }: { params: { id: string } }) {
  const state = await prefetchRoute('${m.route}', { id: params.id });
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>}>
      <PrefetchHydration state={state}>
        <${m.fn} />
      </PrefetchHydration>
    </Suspense>
  );
}
`;
  } else if (m.suspense) {
    serverPage = `import { Suspense } from 'react';
import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import { Spinner } from '@/components/ui/spinner';
import ${m.fn} from '${clientImport}';

export default async function Page() {
  const state = await prefetchRoute('${m.route}');
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>}>
      <PrefetchHydration state={state}>
        <${m.fn} />
      </PrefetchHydration>
    </Suspense>
  );
}
`;
  } else {
    serverPage = `import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ${m.fn} from '${clientImport}';

export default async function Page() {
  const state = await prefetchRoute('${m.route}');
  return (
    <PrefetchHydration state={state}>
      <${m.fn} />
    </PrefetchHydration>
  );
}
`;
  }

  fs.writeFileSync(pagePath, serverPage);
  console.log('Migrated', m.page);
}

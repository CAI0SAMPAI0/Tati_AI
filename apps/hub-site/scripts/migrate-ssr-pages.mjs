import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const migrations = [
  {
    page: 'app/pedidos/page.tsx',
    client: 'pedidos-client-page.tsx',
    fn: 'PedidosClientPage',
    rename: ['PedidosPage', 'PedidosClientPage'],
    prefetch: 'prefetchHubOrders',
  },
  {
    page: 'app/meus-materiais/page.tsx',
    client: 'meus-materiais-client-page.tsx',
    fn: 'MyMaterialsClientPage',
    rename: ['MyMaterialsPage', 'MyMaterialsClientPage'],
    prefetch: 'prefetchHubMyMaterials',
  },
  {
    page: 'app/materiais/[id]/ler/page.tsx',
    client: 'ler-client-page.tsx',
    fn: 'LerClientPage',
    rename: ['LerMaterialPage', 'LerClientPage'],
    prefetch: 'prefetchHubSecureAccess',
    dynamic: true,
  },
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

  const clientImport = `./${m.client.replace('.tsx', '')}`;
  const prefetchArgs = m.dynamic ? 'params.id' : '';

  const serverPage = m.dynamic
    ? `import { prefetchHubSecureAccess } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ${m.fn} from '${clientImport}';

export default async function Page({ params }: { params: { id: string } }) {
  const state = await prefetchHubSecureAccess(params.id);
  return (
    <PrefetchHydration state={state}>
      <${m.fn} />
    </PrefetchHydration>
  );
}
`
    : `import { ${m.prefetch} } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ${m.fn} from '${clientImport}';

export default async function Page() {
  const state = await ${m.prefetch}();
  return (
    <PrefetchHydration state={state}>
      <${m.fn} />
    </PrefetchHydration>
  );
}
`;

  fs.writeFileSync(pagePath, serverPage);
  console.log('Migrated', m.page);
}

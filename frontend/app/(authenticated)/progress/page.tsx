import { createServerPage } from '@/lib/api/create-server-page';
import ProgressClientPage from './progress-client-page';

export default createServerPage({
  route: 'progress',
  ClientPage: ProgressClientPage,
  suspense: false,
});

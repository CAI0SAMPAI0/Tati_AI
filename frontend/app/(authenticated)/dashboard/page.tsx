import { createServerPage } from '@/lib/api/create-server-page';
import DashboardClientPage from './dashboard-client-page';

export default createServerPage({
  route: 'dashboard',
  ClientPage: DashboardClientPage,
  suspense: true,
});

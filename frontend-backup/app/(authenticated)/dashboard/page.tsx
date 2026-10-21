import { Suspense } from 'react';
import DashboardClientPage from './dashboard-client-page';
import Loading from './loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardClientPage />
    </Suspense>
  );
}

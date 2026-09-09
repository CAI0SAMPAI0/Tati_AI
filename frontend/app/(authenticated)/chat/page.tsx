import { Suspense } from 'react';
import ChatClientPage from './chat-client-page';
import Loading from './loading';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatClientPage />
    </Suspense>
  );
}

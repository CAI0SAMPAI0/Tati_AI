'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';

const ReactMarkdownLazy = dynamic(() => import('react-markdown'), { ssr: false });

export default function MarkdownWrapper({ children }: { children: string }) {
  const gfmRef = useRef<any>(null);
  if (gfmRef.current === null) {
    import('remark-gfm').then(m => { gfmRef.current = m.default; });
  }

  return (
    <ReactMarkdownLazy remarkPlugins={gfmRef.current ? [gfmRef.current] : []}>
      {children}
    </ReactMarkdownLazy>
  );
}

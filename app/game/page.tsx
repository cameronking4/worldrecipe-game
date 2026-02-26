'use client';

import dynamic from 'next/dynamic';

const FPSGame = dynamic(() => import('@/components/fps/FPSGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#050b12] text-cyan-100">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-cyan-400/30 border-t-cyan-300" />
        <p className="mt-4 font-mono text-sm uppercase tracking-[0.22em]">Loading Combat Arena</p>
      </div>
    </div>
  ),
});

export default function GamePage() {
  return <FPSGame />;
}

import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl bg-neutral-900/80 border border-white/5 overflow-hidden animate-pulse relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          <div className="absolute bottom-3 left-3 right-3 space-y-2">
            <div className="h-3.5 bg-neutral-800 rounded-md w-3/4" />
            <div className="h-2.5 bg-neutral-800/60 rounded-md w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
};

export const GridCardSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] rounded-2xl bg-neutral-900/80 border border-white/5 overflow-hidden animate-pulse relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          <div className="absolute bottom-3 left-3 right-3 space-y-2">
            <div className="h-3.5 bg-neutral-800 rounded-md w-3/4" />
            <div className="h-2.5 bg-neutral-800/60 rounded-md w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const HeroBannerSkeleton: React.FC = () => {
  return (
    <div className="relative w-full h-72 sm:h-96 md:h-[480px] rounded-3xl bg-neutral-900/80 border border-white/5 overflow-hidden animate-pulse mb-8">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 max-w-xl space-y-3">
        <div className="h-4 bg-orange-500/20 rounded-md w-24" />
        <div className="h-8 bg-neutral-800 rounded-xl w-3/4" />
        <div className="h-4 bg-neutral-800/60 rounded-md w-full" />
        <div className="h-4 bg-neutral-800/60 rounded-md w-2/3" />
        <div className="pt-2 flex gap-3">
          <div className="h-11 bg-orange-600/30 rounded-2xl w-36" />
          <div className="h-11 bg-neutral-800 rounded-2xl w-32" />
        </div>
      </div>
    </div>
  );
};

export const RowSkeleton: React.FC<{ title?: string }> = ({ title = 'Carregando conteúdo...' }) => {
  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between px-1">
        <div className="h-5 bg-neutral-800 rounded-md w-48 animate-pulse" />
      </div>
      <div className="flex gap-3 overflow-hidden py-1">
        <CardSkeleton count={6} />
      </div>
    </div>
  );
};

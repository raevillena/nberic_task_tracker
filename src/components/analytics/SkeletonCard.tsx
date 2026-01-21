// Skeleton loader for analytics cards

'use client';

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-3 sm:mb-4 animate-pulse"></div>
          <div className="h-7 sm:h-8 bg-gray-200 rounded w-14 sm:w-16 mb-2 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-24 sm:w-32 animate-pulse"></div>
        </div>
        <div className="bg-gray-200 rounded-full p-2 sm:p-3 w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 ml-2 animate-pulse"></div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// Skeleton loader for admin task metrics

'use client';

export function SkeletonAdminTaskMetrics() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="h-5 sm:h-6 bg-gray-200 rounded w-40 sm:w-48 mb-3 sm:mb-4 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-2 animate-pulse"></div>
              <div className="h-7 sm:h-8 bg-gray-200 rounded w-14 sm:w-16 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-28 sm:w-32 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 sm:w-40 mb-3 sm:mb-4 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-7 sm:h-8 bg-gray-200 rounded w-10 sm:w-12 mx-auto mb-2 animate-pulse"></div>
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20 mx-auto animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 sm:w-40 mb-3 sm:mb-4 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-7 sm:h-8 bg-gray-200 rounded w-10 sm:w-12 mx-auto mb-2 animate-pulse"></div>
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20 mx-auto animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

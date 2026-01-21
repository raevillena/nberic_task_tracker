// Skeleton loader for high priority backlog

'use client';

export function SkeletonBacklog() {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-40 sm:w-48 mb-2 animate-pulse"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-56 sm:w-64 animate-pulse"></div>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-red-200">
            <thead className="bg-red-100">
              <tr>
                {Array.from({ length: 4 }).map((_, i) => (
                  <th key={i} className="px-3 sm:px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-20 sm:w-24 animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-red-200">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: 4 }).map((_, colIndex) => (
                    <td key={colIndex} className="px-3 sm:px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

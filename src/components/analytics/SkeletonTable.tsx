// Skeleton loader for tables

'use client';

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  title?: boolean;
}

export function SkeletonTable({ rows = 5, cols = 4, title = true }: SkeletonTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      {title && (
        <div className="h-5 sm:h-6 bg-gray-200 rounded w-40 sm:w-48 mb-3 sm:mb-4 animate-pulse"></div>
      )}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i} className="px-3 sm:px-6 py-3">
                    <div className="h-4 bg-gray-200 rounded w-20 sm:w-24 animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: cols }).map((_, colIndex) => (
                    <td key={colIndex} className="px-3 sm:px-6 py-4">
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

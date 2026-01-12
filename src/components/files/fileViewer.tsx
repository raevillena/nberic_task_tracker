// Image preview and file viewer component

'use client';

import { useEffect, useState } from 'react';
import { Message } from '@/types/socket';

interface FileViewerProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function FileViewer({
  message,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: FileViewerProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Reset state when message changes
  useEffect(() => {
    if (message) {
      setImageError(false);
      setImageLoading(true);
    }
  }, [message]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        onPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNext, onPrevious, hasNext, hasPrevious]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !message) return null;

  const fileUrl = message.fileName
    ? `/uploads/${message.fileName}`
    : `/api/files/${message.fileId || ''}`;
  const isImage = message.type === 'image';
  const displayName = message.content || message.fileName || 'File';

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gray-900 text-white px-4 py-3 rounded-t-lg">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{displayName}</h3>
            {message.fileSize && (
              <p className="text-xs text-gray-400 mt-1">
                {formatFileSize(message.fileSize)}
                {message.mimeType && ` • ${message.mimeType}`}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {/* Navigation buttons */}
            {isImage && (hasPrevious || hasNext) && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrevious?.();
                  }}
                  disabled={!hasPrevious}
                  className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Previous (←)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext?.();
                  }}
                  disabled={!hasNext}
                  className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Next (→)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-700 transition-colors"
              title="Close (ESC)"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-gray-900 rounded-b-lg overflow-hidden">
          {isImage ? (
            <div className="relative flex items-center justify-center min-h-[200px] max-h-[85vh]">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {imageError ? (
                <div className="p-8 text-center text-gray-400">
                  <svg
                    className="w-16 h-16 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">Failed to load image</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageError(false);
                      setImageLoading(true);
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <img
                  src={fileUrl}
                  alt={displayName}
                  className="max-w-full max-h-[85vh] object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
                    // Try fallback URL if available
                    if (message.fileId && !fileUrl.includes('/api/files/')) {
                      const img = document.querySelector(`img[src="${fileUrl}"]`) as HTMLImageElement;
                      if (img) {
                        img.src = `/api/files/${message.fileId}`;
                        return; // Don't set error yet, let it try the fallback
                      }
                    }
                    setImageError(true);
                  }}
                />
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-300 min-h-[200px] flex flex-col items-center justify-center">
              <svg
                className="w-20 h-20 mb-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium mb-2">{displayName}</p>
              {message.fileSize && (
                <p className="text-sm text-gray-400 mb-4">
                  {formatFileSize(message.fileSize)}
                </p>
              )}
              <a
                href={fileUrl}
                download={displayName}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        {isImage && (hasPrevious || hasNext) && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded">
            Use ← → arrow keys to navigate
          </div>
        )}
      </div>
    </div>
  );
}

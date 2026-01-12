// Create new study page

'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { createStudyThunk } from '@/store/slices/studySlice';
import Link from 'next/link';

export default function CreateStudyPage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const projectId = parseInt(params.id as string, 10);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isNaN(projectId)) {
        setError('Invalid project ID');
        setIsSubmitting(false);
        return;
      }

      const result = await dispatch(
        createStudyThunk({
          projectId,
          studyData: {
            name: name.trim(),
            description: description.trim() || undefined,
          },
        })
      );

      if (createStudyThunk.fulfilled.match(result)) {
        const study = result.payload;
        if (study && study.id) {
          // Navigate to the project detail page
          router.push(`/dashboard/projects/${projectId}`);
        } else {
          setError('Study created but ID not found. Redirecting to project...');
          setTimeout(() => {
            router.push(`/dashboard/projects/${projectId}`);
          }, 2000);
        }
      } else {
        setError(result.payload as string || 'Failed to create study');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isNaN(projectId)) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Invalid project ID</p>
        <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-700">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link 
          href={`/dashboard/projects/${projectId}`} 
          className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block"
        >
          ← Back to Project
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Study</h1>
        <p className="text-gray-600 mt-1">Create a new study within this project</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Study Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter study name"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter study description (optional)"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center justify-end space-x-4">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={(e) => {
              if (isSubmitting) {
                e.preventDefault();
              }
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Study'}
          </button>
        </div>
      </form>
    </div>
  );
}

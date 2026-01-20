// Create new project page

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { createProjectThunk } from '@/store/slices/projectSlice';
import Link from 'next/link';

export default function CreateProjectPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await dispatch(
        createProjectThunk({
          name: name.trim(),
          description: description.trim() || undefined,
        })
      );

      if (createProjectThunk.fulfilled.match(result)) {
        const project = result.payload;
        if (project && project.id) {
          // Navigate to the project detail page
          router.push(`/dashboard/projects/${project.id}`);
        } else {
          setError('Project created but ID not found. Redirecting to projects list...');
          setTimeout(() => {
            router.push('/dashboard/projects');
          }, 2000);
        }
      } else {
        setError(result.payload as string || 'Failed to create project');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block">
          ← Back to Projects
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-600 mt-1">Create a new research project to organize your studies and tasks</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter project name"
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
            placeholder="Enter project description (optional)"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center justify-end space-x-4">
          <Link
            href="/dashboard/projects"
            className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
            }`}
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
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

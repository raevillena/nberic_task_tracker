// Project detail page

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectByIdThunk, selectCurrentProject } from '@/store/slices/projectSlice';
import { fetchStudiesByProjectThunk, selectStudiesByProjectId } from '@/store/slices/studySlice';
import Link from 'next/link';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projectId = parseInt(params.id as string, 10);

  // Use selectors to get data from normalized state
  const currentProject = useAppSelector(selectCurrentProject);
  const projectLoading = useAppSelector((state) => state.project.isLoading);
  const studies = useAppSelector((state) => selectStudiesByProjectId(state, projectId));
  const studiesLoading = useAppSelector((state) => state.study.isLoading);
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectByIdThunk(projectId));
      dispatch(fetchStudiesByProjectThunk(projectId));
    }
  }, [dispatch, projectId]);

  if (projectLoading) {
    return <div className="text-center py-8">Loading project...</div>;
  }

  if (!currentProject) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Project not found</p>
        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block">
          ← Back to Projects
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{currentProject.name}</h1>
            {currentProject.description && (
              <p className="text-gray-600 mt-2">{currentProject.description}</p>
            )}
          </div>
          {user?.role === 'Manager' && (
            <Link
              href={`/dashboard/projects/${projectId}/studies/new`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create Study
            </Link>
          )}
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Project Progress</span>
            <span className="text-sm font-medium">{currentProject.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all"
              style={{ width: `${currentProject.progress}%` }}
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Studies</h2>
        {studiesLoading ? (
          <div className="text-center py-8">Loading studies...</div>
        ) : studies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No studies found. {user?.role === 'Manager' && 'Create your first study!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map((study) => (
              <Link
                key={study.id}
                href={`/dashboard/projects/${projectId}/studies/${study.id}`}
                className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold mb-2">{study.name}</h3>
                {study.description && (
                  <p className="text-gray-600 text-sm mb-4">{study.description}</p>
                )}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium">{study.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${study.progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// Projects list page

'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectsThunk, selectAllProjects } from '@/store/slices/projectSlice';
import Link from 'next/link';

export default function ProjectsPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(selectAllProjects);
  const isLoading = useAppSelector((state) => state.project.isLoading);
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchProjectsThunk());
  }, [dispatch]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage and track all your research projects</p>
        </div>
        {user?.role === 'Manager' && (
          <Link
            href="/dashboard/projects/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Project
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No projects</h3>
          <p className="mt-2 text-sm text-gray-500">
            {user?.role === 'Manager'
              ? 'Get started by creating a new project.'
              : 'No projects have been assigned to you yet.'}
          </p>
          {user?.role === 'Manager' && (
            <div className="mt-6">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Project
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 hover:border-indigo-300"
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    project.progress === 100
                      ? 'bg-green-100 text-green-800'
                      : project.progress > 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {project.progress === 100 ? 'Completed' : project.progress > 0 ? 'In Progress' : 'Not Started'}
                </span>
              </div>
              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{project.description}</p>
              )}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm font-semibold text-gray-900">{project.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      project.progress === 100
                        ? 'bg-green-600'
                        : project.progress > 0
                        ? 'bg-indigo-600'
                        : 'bg-gray-300'
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

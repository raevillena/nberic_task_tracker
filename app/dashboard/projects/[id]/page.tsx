// Project detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectByIdThunk, deleteProjectThunk, updateProjectThunk } from '@/store/slices/projectSlice';
import { fetchStudiesByProjectThunk, selectStudiesByProjectId } from '@/store/slices/studySlice';
import { UserRole } from '@/types/entities';
import Link from 'next/link';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projectId = parseInt(params.id as string, 10);

  const project = useAppSelector((state) => 
    projectId && !isNaN(projectId) ? state.project.entities[projectId] : undefined
  );
  const projectLoading = useAppSelector((state) => state.project.isLoading);
  const projectError = useAppSelector((state) => state.project.error);
  const studies = useAppSelector((state) => 
    projectId && !isNaN(projectId) ? selectStudiesByProjectId(state, projectId) : []
  );
  const studiesLoading = useAppSelector((state) => state.study.isLoading);
  const isUpdating = useAppSelector((state) => state.project.isUpdating);
  const { user } = useAppSelector((state) => state.auth);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && !isNaN(projectId)) {
      // Only fetch if project is not already in state
      if (!project) {
        dispatch(fetchProjectByIdThunk(projectId));
      }
      dispatch(fetchStudiesByProjectThunk(projectId));
    }
  }, [dispatch, projectId, project]);

  // Mark project as read when viewed by researcher
  useEffect(() => {
    if (project && projectId && !isNaN(projectId) && user?.role === UserRole.RESEARCHER) {
      // Mark project as read in the background (don't block UI)
      fetch(`/api/projects/${projectId}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        // Silently fail - this is not critical
        console.error('Failed to mark project as read:', error);
      });
    }
  }, [project, projectId, user]);

  // Initialize edit form when modal opens
  useEffect(() => {
    if (showEditModal && project) {
      setEditName(project.name || '');
      setEditDescription(project.description || '');
      setEditError(null);
    }
  }, [showEditModal, project]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to move this project to trash? It can be restored later from the Trash page.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await dispatch(deleteProjectThunk(projectId)).unwrap();
      // Redirect to projects list after deletion
      router.push('/dashboard/projects');
    } catch (error) {
      alert('Failed to delete project: ' + (error as Error).message);
      setIsDeleting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Project name is required');
      return;
    }

    try {
      await dispatch(
        updateProjectThunk({
          projectId,
          updates: {
            name: editName.trim(),
            description: editDescription.trim() || undefined,
          },
        })
      ).unwrap();
      setShowEditModal(false);
      // Project will be updated in Redux state automatically
    } catch (error) {
      setEditError('Failed to update project: ' + (error as Error).message);
    }
  };

  if (projectLoading && !project) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading project...</p>
      </div>
    );
  }

  if (projectError && !project) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{projectError}</p>
        <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-700">
          Back to Projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Project not found</p>
        <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-700">
          Back to Projects
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
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {user?.role === 'Manager' && (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Edit Project
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Moving to Trash...' : 'Move to Trash'}
                </button>
                <Link
                  href={`/dashboard/projects/${projectId}/studies/new`}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Study
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Project Progress</span>
            <span className="text-sm font-medium">{project.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
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
                      className={`h-2 rounded-full transition-all ${
                        study.progress === 100
                          ? 'bg-green-600'
                          : study.progress > 0
                          ? 'bg-indigo-600'
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${study.progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-6">
                {editError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800">{editError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter project description (optional)"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditError(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </span>
                    ) : (
                      'Update Project'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

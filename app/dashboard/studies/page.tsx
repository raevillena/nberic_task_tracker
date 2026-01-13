// Studies list page - shows all studies across all projects

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectsThunk, selectAllProjects } from '@/store/slices/projectSlice';
import { fetchStudiesByProjectThunk, selectAllStudies, createStudyThunk } from '@/store/slices/studySlice';
import { UserRole } from '@/types/entities';
import Link from 'next/link';

export default function StudiesPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projects = useAppSelector(selectAllProjects);
  const studies = useAppSelector(selectAllStudies);
  const isLoadingProjects = useAppSelector((state) => state.project.isLoading);
  const isLoadingStudies = useAppSelector((state) => state.study.isLoading);
  const isCreating = useAppSelector((state) => state.study.isCreating);
  const { user } = useAppSelector((state) => state.auth);
  const [loadedProjectIds, setLoadedProjectIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [studyName, setStudyName] = useState('');
  const [studyDescription, setStudyDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Mark study as read when clicked by researcher
  const handleStudyClick = async (projectId: number, studyId: number) => {
    if (user?.role === UserRole.RESEARCHER) {
      // Mark as read in the background (don't block navigation)
      fetch(`/api/projects/${projectId}/studies/${studyId}/read`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(() => {
          // Trigger badge count refresh
          window.dispatchEvent(new CustomEvent('refreshUnreadCounts'));
        })
        .catch((error) => {
          // Silently fail - this is not critical
          console.error('Failed to mark study as read:', error);
        });
    }
    // Navigate to study detail
    router.push(`/dashboard/projects/${projectId}/studies/${studyId}`);
  };

  useEffect(() => {
    dispatch(fetchProjectsThunk());
  }, [dispatch]);

  // Load studies for each project
  useEffect(() => {
    projects.forEach((project) => {
      if (!loadedProjectIds.has(project.id)) {
        dispatch(fetchStudiesByProjectThunk(project.id));
        setLoadedProjectIds((prev) => new Set(prev).add(project.id));
      }
    });
  }, [projects, dispatch, loadedProjectIds]);

  const isLoading = isLoadingProjects || isLoadingStudies;

  // Get studies by project using Redux state
  const byProjectId = useAppSelector((state) => state.study.byProjectId);
  
  // Group studies by project
  const studiesByProject = projects
    .map((project) => {
      const studyIds = byProjectId[project.id] || [];
      const projectStudies = studyIds
        .map((studyId) => studies.find((s) => s.id === studyId))
        .filter((study): study is typeof studies[0] => study !== undefined);
      return { project, studies: projectStudies };
    })
    .filter((group) => group.studies.length > 0);

  // Flatten all studies
  const allStudies = studies;

  const handleCreateStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProjectId || selectedProjectId === '') {
      setFormError('Please select a project');
      return;
    }

    if (!studyName.trim()) {
      setFormError('Study name is required');
      return;
    }

    const result = await dispatch(
      createStudyThunk({
        projectId: selectedProjectId as number,
        studyData: {
          name: studyName.trim(),
          description: studyDescription.trim() || undefined,
        },
      })
    );

    if (createStudyThunk.fulfilled.match(result)) {
      const study = result.payload;
      // Refresh studies for the selected project
      dispatch(fetchStudiesByProjectThunk(selectedProjectId as number));
      // Close modal and reset form
      setShowCreateModal(false);
      setSelectedProjectId('');
      setStudyName('');
      setStudyDescription('');
      setFormError(null);
      // Navigate to the project detail page
      router.push(`/dashboard/projects/${selectedProjectId}`);
    } else {
      setFormError(result.payload as string || 'Failed to create study');
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Studies</h1>
          <p className="text-gray-600 mt-1">View and manage all studies across your projects</p>
        </div>
        {user?.role === 'Manager' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Study
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading studies...</p>
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
          <h3 className="mt-4 text-lg font-medium text-gray-900">Projects Required</h3>
          <p className="mt-2 text-sm text-gray-500">
            {user?.role === 'Manager'
              ? 'You need to create a project first before you can add studies. Studies are organized within projects.'
              : 'No projects have been created yet. Please contact a manager to create a project.'}
          </p>
          {user?.role === 'Manager' && (
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Project
              </Link>
              <Link
                href="/dashboard/projects"
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                View Projects
              </Link>
            </div>
          )}
        </div>
      ) : allStudies.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No studies found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {user?.role === 'Manager'
              ? 'Create your first study to get started. Studies help organize tasks within your projects.'
              : 'No studies have been assigned to you yet.'}
          </p>
          {user?.role === 'Manager' && (
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Study
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {studiesByProject.map(({ project, studies: projectStudies }) => (
            <div key={project.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-xl font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    {project.name}
                  </Link>
                  <p className="text-sm text-gray-600 mt-1">{projectStudies.length} study(ies)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectStudies.map((study) => (
                  <button
                    key={study.id}
                    onClick={() => handleStudyClick(project.id, study.id)}
                    className="block w-full text-left p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {user?.role === 'Researcher' && !(study as any).isRead && (
                        <div className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0" title="Unread" />
                      )}
                      <h3 className={`text-lg font-semibold mb-0 ${
                        user?.role === 'Researcher' && !(study as any).isRead 
                          ? 'text-indigo-700 font-bold' 
                          : 'text-gray-900'
                      }`}>
                        {study.name}
                      </h3>
                    </div>
                    {study.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{study.description}</p>
                    )}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">Progress</span>
                        <span className="text-xs font-medium">{study.progress.toFixed(1)}%</span>
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
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Study Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Study</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedProjectId('');
                    setStudyName('');
                    setStudyDescription('');
                    setFormError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateStudy} className="space-y-6">
                <div>
                  <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="project"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value, 10) : '')}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isCreating}
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="studyName" className="block text-sm font-medium text-gray-700 mb-2">
                    Study Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="studyName"
                    value={studyName}
                    onChange={(e) => setStudyName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter study name"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label htmlFor="studyDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="studyDescription"
                    value={studyDescription}
                    onChange={(e) => setStudyDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter study description (optional)"
                    disabled={isCreating}
                  />
                </div>

                {formError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedProjectId('');
                      setStudyName('');
                      setStudyDescription('');
                      setFormError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !selectedProjectId || !studyName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating...' : 'Create Study'}
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

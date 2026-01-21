// Trash page - displays all deleted projects, studies, and tasks

'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectsThunk } from '@/store/slices/projectSlice';
import { fetchStudiesByProjectThunk } from '@/store/slices/studySlice';
import { fetchAllTasksThunk } from '@/store/slices/taskSlice';
import { UserRole } from '@/types/entities';
import { apiRequest } from '@/lib/utils/api';

interface TrashProject {
  id: number;
  name: string;
  description: string | null;
  progress: number;
  deletedAt: string;
  createdBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface TrashStudy {
  id: number;
  name: string;
  description: string | null;
  progress: number;
  projectId: number;
  deletedAt: string;
  project?: {
    id: number;
    name: string;
  };
  createdBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface TrashTask {
  id: number;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  studyId: number;
  deletedAt: string;
  study?: {
    id: number;
    name: string;
    projectId: number;
    project?: {
      id: number;
      name: string;
    };
  };
  createdBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

type TrashTab = 'projects' | 'studies' | 'tasks';

export default function TrashPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState<TrashTab>('projects');
  const [trashProjects, setTrashProjects] = useState<TrashProject[]>([]);
  const [trashStudies, setTrashStudies] = useState<TrashStudy[]>([]);
  const [trashTasks, setTrashTasks] = useState<TrashTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<{ type: string; id: number } | null>(null);

  // Only managers can access trash
  useEffect(() => {
    if (user?.role !== UserRole.MANAGER) {
      return;
    }

    fetchAllTrash();
  }, [user?.role]);

  const fetchAllTrash = async () => {
    try {
      setIsLoading(true);
      // Use apiRequest to automatically include Authorization header
      const [projectsRes, studiesRes, tasksRes] = await Promise.all([
        apiRequest('/api/projects/trash', { credentials: 'include' }),
        apiRequest('/api/studies/trash', { credentials: 'include' }),
        apiRequest('/api/tasks/trash', { credentials: 'include' }),
      ]);

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setTrashProjects(data.data || []);
      }
      if (studiesRes.ok) {
        const data = await studiesRes.json();
        setTrashStudies(data.data || []);
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTrashTasks(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreProject = async (projectId: number) => {
    try {
      setRestoringId({ type: 'project', id: projectId });
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/projects/${projectId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setTrashProjects((prev) => prev.filter((p) => p.id !== projectId));
        dispatch(fetchProjectsThunk());
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to restore project');
      }
    } catch (error) {
      console.error('Error restoring project:', error);
      alert('Failed to restore project');
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreStudy = async (studyId: number) => {
    try {
      setRestoringId({ type: 'study', id: studyId });
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/studies/${studyId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTrashStudies((prev) => prev.filter((s) => s.id !== studyId));
        // Refresh studies for the project
        if (data.data?.projectId) {
          dispatch(fetchStudiesByProjectThunk(data.data.projectId));
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to restore study');
      }
    } catch (error) {
      console.error('Error restoring study:', error);
      alert('Failed to restore study');
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreTask = async (taskId: number) => {
    try {
      setRestoringId({ type: 'task', id: taskId });
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/tasks/${taskId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTrashTasks((prev) => prev.filter((t) => t.id !== taskId));
        // Refresh tasks
        dispatch(fetchAllTasksThunk());
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to restore task');
      }
    } catch (error) {
      console.error('Error restoring task:', error);
      alert('Failed to restore task');
    } finally {
      setRestoringId(null);
    }
  };

  if (user?.role !== UserRole.MANAGER) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600">Only managers can access the trash.</p>
      </div>
    );
  }

  const totalCount = trashProjects.length + trashStudies.length + trashTasks.length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trash</h1>
          <p className="text-gray-600 mt-1">Deleted items are stored here permanently</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'projects'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Projects ({trashProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('studies')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'studies'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Studies ({trashStudies.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tasks'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tasks ({trashTasks.length})
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading trash...</p>
        </div>
      ) : totalCount === 0 ? (
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Trash is empty</h3>
          <p className="mt-2 text-sm text-gray-500">No items have been deleted yet.</p>
        </div>
      ) : (
        <>
          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trashProjects.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No deleted projects
                </div>
              ) : (
                trashProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-6 bg-white rounded-lg shadow-md border border-gray-200 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Deleted
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{project.description}</p>
                    )}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm text-gray-600">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">
                        Deleted: {new Date(project.deletedAt).toLocaleDateString()}
                      </p>
                      {project.createdBy && (
                        <p className="text-xs text-gray-500">
                          Created by: {project.createdBy.firstName} {project.createdBy.lastName}
                        </p>
                      )}
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleRestoreProject(project.id)}
                        disabled={restoringId?.type === 'project' && restoringId?.id === project.id}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoringId?.type === 'project' && restoringId?.id === project.id ? 'Restoring...' : 'Restore Project'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Studies Tab */}
          {activeTab === 'studies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trashStudies.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No deleted studies
                </div>
              ) : (
                trashStudies.map((study) => (
                  <div
                    key={study.id}
                    className="p-6 bg-white rounded-lg shadow-md border border-gray-200 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{study.name}</h2>
                        {study.project && (
                          <p className="text-xs text-gray-500 mt-1">Project: {study.project.name}</p>
                        )}
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Deleted
                      </span>
                    </div>
                    {study.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{study.description}</p>
                    )}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm text-gray-600">{study.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${study.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">
                        Deleted: {new Date(study.deletedAt).toLocaleDateString()}
                      </p>
                      {study.createdBy && (
                        <p className="text-xs text-gray-500">
                          Created by: {study.createdBy.firstName} {study.createdBy.lastName}
                        </p>
                      )}
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleRestoreStudy(study.id)}
                        disabled={restoringId?.type === 'study' && restoringId?.id === study.id}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoringId?.type === 'study' && restoringId?.id === study.id ? 'Restoring...' : 'Restore Study'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trashTasks.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No deleted tasks
                </div>
              ) : (
                trashTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-6 bg-white rounded-lg shadow-md border border-gray-200 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{task.name}</h2>
                        {task.study?.project && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.study.project.name} → {task.study.name}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Deleted
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{task.description}</p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">
                        Deleted: {new Date(task.deletedAt).toLocaleDateString()}
                      </p>
                      {task.createdBy && (
                        <p className="text-xs text-gray-500">
                          Created by: {task.createdBy.firstName} {task.createdBy.lastName}
                        </p>
                      )}
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleRestoreTask(task.id)}
                        disabled={restoringId?.type === 'task' && restoringId?.id === task.id}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoringId?.type === 'task' && restoringId?.id === task.id ? 'Restoring...' : 'Restore Task'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Study detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchStudyByIdThunk, updateStudyThunk, deleteStudyThunk } from '@/store/slices/studySlice';
import { fetchTasksByStudyThunk, selectTasksByStudyId, createTaskThunk } from '@/store/slices/taskSlice';
import { addNotification } from '@/store/slices/notificationSlice';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import Link from 'next/link';

export default function StudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projectId = parseInt(params.id as string, 10);
  const studyId = parseInt(params.studyId as string, 10);

  const study = useAppSelector((state) =>
    studyId && !isNaN(studyId) ? state.study.entities[studyId] : undefined
  );
  const isLoading = useAppSelector((state) => state.study.isLoading);
  const isUpdating = useAppSelector((state) => state.study.isUpdating);
  const isDeleting = useAppSelector((state) => state.study.isDeleting);
  const error = useAppSelector((state) => state.study.error);
  const tasks = useAppSelector((state) =>
    studyId && !isNaN(studyId) ? selectTasksByStudyId(state, studyId) : []
  );
  const isLoadingTasks = useAppSelector((state) => state.task.isLoading);
  const isCreatingTask = useAppSelector((state) => state.task.isCreating);
  const { user } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Task creation modal state
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [assignedToId, setAssignedToId] = useState<string>(''); // Legacy single assignment
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]); // Multiple assignments
  const [dueDate, setDueDate] = useState('');
  const [researchers, setResearchers] = useState<Array<{ id: number; email: string; firstName: string; lastName: string }>>([]);
  const [loadingResearchers, setLoadingResearchers] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  useEffect(() => {
    if (studyId && !isNaN(studyId) && projectId && !isNaN(projectId)) {
      // Only fetch if study is not already in state
      if (!study) {
        dispatch(fetchStudyByIdThunk({ projectId, studyId }));
      } else {
        // Initialize edit form with current study data
        setEditName(study.name);
        setEditDescription(study.description || '');
      }
      // Always fetch tasks for this study
      dispatch(fetchTasksByStudyThunk(studyId));
    }
  }, [dispatch, studyId, projectId, study]);

  // Update edit form when study changes
  useEffect(() => {
    if (study) {
      setEditName(study.name);
      setEditDescription(study.description || '');
    }
  }, [study]);

  // Fetch researchers when modal opens
  useEffect(() => {
    if (showCreateTaskModal && researchers.length === 0 && !loadingResearchers) {
      setLoadingResearchers(true);
      fetch('/api/users/researchers', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setResearchers(data.data);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch researchers:', err);
        })
        .finally(() => {
          setLoadingResearchers(false);
        });
    }
  }, [showCreateTaskModal, researchers.length, loadingResearchers]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editName.trim()) {
      setFormError('Study name is required');
      return;
    }

    const result = await dispatch(
      updateStudyThunk({
        projectId,
        studyId,
        updates: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        },
      })
    );

    if (updateStudyThunk.fulfilled.match(result)) {
      setIsEditing(false);
      // Refresh study data
      dispatch(fetchStudyByIdThunk({ projectId, studyId }));
    } else {
      setFormError(result.payload as string || 'Failed to update study');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this study? This will also delete all associated tasks. This action cannot be undone.')) {
      return;
    }

    const result = await dispatch(
      deleteStudyThunk({
        projectId,
        studyId,
      })
    );

    if (deleteStudyThunk.fulfilled.match(result)) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskFormError(null);

    if (!taskName.trim()) {
      setTaskFormError('Task name is required');
      return;
    }

    const result = await dispatch(
      createTaskThunk({
        studyId,
        taskData: {
          name: taskName.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          assignedToId: assignedUserIds.length > 0 ? assignedUserIds[0] : (assignedToId ? parseInt(assignedToId, 10) : undefined),
          dueDate: dueDate || undefined,
        },
      })
    );

    if (createTaskThunk.fulfilled.match(result)) {
      const task = result.payload;
      
      // Assign to multiple researchers if selected
      if (assignedUserIds.length > 0 && task && task.id) {
        try {
          await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${task.id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userIds: assignedUserIds }),
          });
        } catch (error) {
          console.error('Failed to assign multiple researchers:', error);
          // Continue anyway - task was created
        }
      }
      
      // Refresh tasks list
      dispatch(fetchTasksByStudyThunk(studyId));
      // Close modal and reset form
      setShowCreateTaskModal(false);
      setTaskName('');
      setTaskDescription('');
      setTaskPriority(TaskPriority.MEDIUM);
      setAssignedToId('');
      setAssignedUserIds([]);
      setDueDate('');
      setTaskFormError(null);
    } else {
      setTaskFormError(result.payload as string || 'Failed to create task');
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return 'bg-red-100 text-red-800 border-red-300';
      case TaskPriority.HIGH:
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case TaskPriority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case TaskPriority.LOW:
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case TaskStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading && !study) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading study...</p>
      </div>
    );
  }

  if (error && !study) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href={`/dashboard/projects/${projectId}`} className="text-indigo-600 hover:text-indigo-700">
          Back to Project
        </Link>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Study not found</p>
        <Link href={`/dashboard/projects/${projectId}`} className="text-indigo-600 hover:text-indigo-700">
          Back to Project
        </Link>
      </div>
    );
  }

  const canEdit = user?.role === UserRole.MANAGER;
  const canDelete = user?.role === UserRole.MANAGER;
  const canCreateTask = user?.role === UserRole.MANAGER;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block"
        >
          ← Back to Project
        </Link>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label htmlFor="editName" className="block text-sm font-medium text-gray-700 mb-2">
                    Study Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="editDescription"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating}
                  />
                </div>
                {formError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                )}
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormError(null);
                      setEditName(study.name);
                      setEditDescription(study.description || '');
                    }}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{study.name}</h1>
                {study.description && (
                  <p className="text-gray-600 mb-4">{study.description}</p>
                )}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Study Progress</span>
                    <span className="text-sm font-medium">{study.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
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
              </>
            )}
          </div>
          {!isEditing && (
            <div className="flex space-x-2">
              {canCreateTask && (
                <button
                  onClick={() => setShowCreateTaskModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Task
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Study Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Project</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="text-indigo-600 hover:text-indigo-700"
              >
                {study.project?.name || 'Unknown Project'}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {study.createdBy
                ? `${study.createdBy.firstName} ${study.createdBy.lastName} (${study.createdBy.email})`
                : 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(study.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Tasks</dt>
            <dd className="mt-1 text-sm text-gray-900">{tasks.length}</dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Tasks</h2>
        </div>

        {isLoadingTasks ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No tasks found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {canCreateTask
                ? 'Create your first task to get started.'
                : 'No tasks have been assigned to you yet.'}
            </p>
            {canCreateTask && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateTaskModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Task
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/projects/${projectId}/studies/${studyId}/tasks/${task.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                        >
                          {task.name}
                        </Link>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.assignedTo ? (
                          <div className="text-sm text-gray-900">
                            {task.assignedTo.firstName} {task.assignedTo.lastName}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'No due date'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Task</h2>
                <button
                  onClick={() => {
                    setShowCreateTaskModal(false);
                    setTaskName('');
                    setTaskDescription('');
                      setTaskPriority(TaskPriority.MEDIUM);
                      setAssignedToId('');
                      setAssignedUserIds([]);
                      setDueDate('');
                      setTaskFormError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-6">
                <div>
                  <label htmlFor="taskName" className="block text-sm font-medium text-gray-700 mb-2">
                    Task Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="taskName"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter task name"
                    disabled={isCreatingTask}
                  />
                </div>

                <div>
                  <label htmlFor="taskDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="taskDescription"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter task description (optional)"
                    disabled={isCreatingTask}
                  />
                </div>

                <div>
                  <label htmlFor="taskPriority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="taskPriority"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isCreatingTask}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.URGENT}>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To (Select multiple researchers)
                  </label>
                  <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto p-2">
                    {loadingResearchers ? (
                      <p className="text-sm text-gray-500 py-2">Loading researchers...</p>
                    ) : researchers.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No researchers available</p>
                    ) : (
                      researchers.map((researcher) => (
                        <label key={researcher.id} className="flex items-center space-x-2 py-2 px-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignedUserIds.includes(researcher.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedUserIds([...assignedUserIds, researcher.id]);
                                // Also update legacy field for backward compatibility
                                if (!assignedToId) {
                                  setAssignedToId(researcher.id);
                                }
                              } else {
                                setAssignedUserIds(assignedUserIds.filter((id) => id !== researcher.id));
                                // Update legacy field if it was the removed user
                                if (assignedToId === researcher.id) {
                                  setAssignedToId(assignedUserIds.length > 1 ? assignedUserIds[0] : '');
                                }
                              }
                            }}
                            disabled={isCreatingTask}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">
                            {researcher.firstName} {researcher.lastName} ({researcher.email})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {assignedUserIds.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {assignedUserIds.length} researcher{assignedUserIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    id="dueDate"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isCreatingTask}
                  />
                </div>

                {taskFormError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{taskFormError}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTaskModal(false);
                      setTaskName('');
                      setTaskDescription('');
                      setTaskPriority(TaskPriority.MEDIUM);
                      setAssignedToId('');
                      setAssignedUserIds([]);
                      setDueDate('');
                      setTaskFormError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isCreatingTask}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTask || !taskName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingTask ? 'Creating...' : 'Create Task'}
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

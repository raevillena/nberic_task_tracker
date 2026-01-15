// Task detail page for project-level admin tasks

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTaskByIdDirectThunk } from '@/store/slices/taskSlice';
import { TaskStatus, TaskPriority, UserRole, TaskType } from '@/types/entities';
import Link from 'next/link';
import { TaskChat } from '@/components/tasks/TaskChat';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function ProjectTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { getReferrer } = useNavigationHistory();
  const projectId = parseInt(params.id as string, 10);
  const taskId = parseInt(params.taskId as string, 10);
  
  // Get back URL - default to project page
  const backUrl = getReferrer(
    pathname,
    `/dashboard/projects/${projectId}`
  );

  const task = useAppSelector((state) =>
    taskId && !isNaN(taskId) ? state.task.entities[taskId] : undefined
  );
  const project = useAppSelector((state) =>
    projectId && !isNaN(projectId) ? state.project.entities[projectId] : undefined
  );

  // Build breadcrumbs
  const breadcrumbItems = [
    { label: 'Projects', href: '/dashboard/projects' },
    { label: project?.name || 'Project', href: `/dashboard/projects/${projectId}` },
    { label: task?.name || 'Task', href: '#' }
  ];

  const isLoading = useAppSelector((state) => state.task.isLoading);
  const error = useAppSelector((state) => state.task.error);
  const { user } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [editStatus, setEditStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<number[]>([]);
  const [editDueDate, setEditDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [researchers, setResearchers] = useState<Array<{ id: number; email: string; firstName: string; lastName: string }>>([]);
  const [loadingResearchers, setLoadingResearchers] = useState(false);

  useEffect(() => {
    if (taskId && !isNaN(taskId)) {
      // Only fetch if task is not already in state
      if (!task) {
        dispatch(fetchTaskByIdDirectThunk({ taskId }));
      } else {
        // Initialize edit form with current task data
        setEditName(task.name);
        setEditDescription(task.description || '');
        setEditPriority(task.priority);
        setEditStatus(task.status);
        const assignedIds: number[] = [];
        if (task.assignedToId) {
          assignedIds.push(task.assignedToId);
        }
        if (task.assignedResearchers && Array.isArray(task.assignedResearchers)) {
          task.assignedResearchers.forEach((r) => {
            if (!assignedIds.includes(r.id)) {
              assignedIds.push(r.id);
            }
          });
        }
        setEditAssignedUserIds(assignedIds);
        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
      }
    }
  }, [dispatch, taskId, task]);

  // Update edit form when task changes
  useEffect(() => {
    if (task) {
      setEditName(task.name);
      setEditDescription(task.description || '');
      setEditPriority(task.priority);
      setEditStatus(task.status);
      const assignedIds: number[] = [];
      if (task.assignedToId) {
        assignedIds.push(task.assignedToId);
      }
      if (task.assignedResearchers && Array.isArray(task.assignedResearchers)) {
        task.assignedResearchers.forEach((r) => {
          if (!assignedIds.includes(r.id)) {
            assignedIds.push(r.id);
          }
        });
      }
      setEditAssignedUserIds(assignedIds);
      setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
    }
  }, [task]);

  // Load researchers when editing (for managers)
  useEffect(() => {
    if (isEditing && user?.role === UserRole.MANAGER && researchers.length === 0 && !loadingResearchers) {
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
  }, [isEditing, user?.role, researchers.length, loadingResearchers]);

  // Mark task as read when viewed
  useEffect(() => {
    if (task && taskId && !isNaN(taskId) && user) {
      // Mark task as read in the background (don't block UI)
      fetch(`/api/tasks/${taskId}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        // Silently fail - this is not critical
        console.error('Failed to mark task as read:', error);
      });
    }
  }, [task, taskId, user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsUpdating(true);

    if (!editName.trim()) {
      setFormError('Task name is required');
      setIsUpdating(false);
      return;
    }

    const updateData: any = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      status: editStatus,
      dueDate: editDueDate || null,
    };

    // For single assignment, use the first selected user (legacy support)
    if (editAssignedUserIds.length > 0) {
      updateData.assignedToId = editAssignedUserIds[0];
    } else {
      updateData.assignedToId = null;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to update task');
        return;
      }

      // If manager changed assignments, update multiple assignments
      if (user?.role === UserRole.MANAGER && editAssignedUserIds.length > 0) {
        try {
          await fetch(`/api/tasks/${taskId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userIds: editAssignedUserIds }),
          });
        } catch (error) {
          console.error('Failed to update task assignments:', error);
        }
      }

      // Refresh task data
      dispatch(fetchTaskByIdDirectThunk({ taskId }));
      setIsEditing(false);
    } catch (error) {
      setFormError('Failed to update task');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to move this task to trash? It can be restored later from the Trash page.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to delete task');
        return;
      }

      router.push(`/dashboard/projects/${projectId}`);
    } catch (error) {
      setFormError('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to complete task');
        return;
      }

      dispatch(fetchTaskByIdDirectThunk({ taskId }));
    } catch (error) {
      setFormError('Failed to complete task');
    }
  };

  if (isLoading && !task) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading task...</p>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href={backUrl} className="text-indigo-600 hover:text-indigo-700">
          Back
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Task not found</p>
        <Link href={backUrl} className="text-indigo-600 hover:text-indigo-700">
          Back
        </Link>
      </div>
    );
  }

  // Only show admin tasks on this page
  if (task.taskType !== TaskType.ADMIN || !task.projectId || task.projectId !== projectId) {
    // Redirect to appropriate page based on task type
    if (task.studyId && task.study?.project?.id) {
      router.push(`/dashboard/projects/${task.study.project.id}/studies/${task.studyId}/tasks/${task.id}`);
      return null;
    } else if (task.taskType === TaskType.ADMIN && !task.projectId) {
      router.push(`/dashboard/tasks/${task.id}`);
      return null;
    }
  }

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

  const canEdit = user?.role === UserRole.MANAGER;
  const canDelete = user?.role === UserRole.MANAGER;
  const canComplete = user?.role === UserRole.MANAGER && task.status !== TaskStatus.COMPLETED;

  return (
    <div>
      <div className="mb-6">
        <Breadcrumbs items={breadcrumbItems} />
        <Link
          href={backUrl}
          className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block"
        >
          ← Back
        </Link>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label htmlFor="editName" className="block text-sm font-medium text-gray-700 mb-2">
                    Task Name <span className="text-red-500">*</span>
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
                <div>
                  <label htmlFor="editPriority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="editPriority"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.URGENT}>Urgent</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="editDueDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    id="editDueDate"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To (Select multiple researchers)
                  </label>
                  <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto p-2">
                    {loadingResearchers ? (
                      <div className="flex items-center justify-center py-4 space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        <p className="text-sm text-gray-500">Loading researchers...</p>
                      </div>
                    ) : researchers.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No researchers available</p>
                    ) : (
                      researchers.map((researcher) => (
                        <label key={researcher.id} className="flex items-center space-x-2 py-2 px-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editAssignedUserIds.includes(researcher.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAssignedUserIds([...editAssignedUserIds, researcher.id]);
                              } else {
                                setEditAssignedUserIds(editAssignedUserIds.filter((id) => id !== researcher.id));
                              }
                            }}
                            disabled={isUpdating}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">
                            {researcher.firstName} {researcher.lastName} ({researcher.email})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {editAssignedUserIds.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {editAssignedUserIds.length} researcher{editAssignedUserIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="editStatus" className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating}
                  >
                    <option value={TaskStatus.PENDING}>Pending</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.COMPLETED}>Completed</option>
                    <option value={TaskStatus.CANCELLED}>Cancelled</option>
                  </select>
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
                      if (task) {
                        setEditName(task.name);
                        setEditDescription(task.description || '');
                        setEditPriority(task.priority);
                        setEditStatus(task.status);
                        const assignedIds: number[] = [];
                        if (task.assignedToId) {
                          assignedIds.push(task.assignedToId);
                        }
                        if (task.assignedResearchers && Array.isArray(task.assignedResearchers)) {
                          task.assignedResearchers.forEach((r) => {
                            if (!assignedIds.includes(r.id)) {
                              assignedIds.push(r.id);
                            }
                          });
                        }
                        setEditAssignedUserIds(assignedIds);
                        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
                      }
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
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{task.name}</h1>
                  <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                    Admin Task
                  </span>
                </div>
                {task.description && (
                  <p className="text-gray-600 mb-4">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mb-4">
                  <span className={`px-3 py-1 text-sm font-medium rounded border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  {task.project && (
                    <span className="px-3 py-1 text-sm text-gray-600">
                      Project: <Link href={`/dashboard/projects/${task.project.id}`} className="text-indigo-600 hover:text-indigo-700">{task.project.name}</Link>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Created By</p>
                    <p className="text-sm font-medium text-gray-900">
                      {task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created At</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {task.dueDate && (
                    <div>
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {task.completedAt && (
                    <div>
                      <p className="text-sm text-gray-500">Completed At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(task.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Assigned To</p>
                  {task.assignedTo ? (
                    <p className="text-sm font-medium text-gray-900">
                      {task.assignedTo.firstName} {task.assignedTo.lastName}
                    </p>
                  ) : task.assignedResearchers && task.assignedResearchers.length > 0 ? (
                    <div className="space-y-1">
                      {task.assignedResearchers.map((r: any) => (
                        <p key={r.id} className="text-sm font-medium text-gray-900">
                          {r.firstName} {r.lastName}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Unassigned</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Edit Task
                    </button>
                  )}
                  {canComplete && (
                    <button
                      onClick={handleComplete}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Mark Complete
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Task'}
                    </button>
                  )}
                </div>
                {formError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Task Chat */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="h-[500px]">
          <TaskChat
            taskId={taskId}
            taskName={task.name}
            projectId={projectId}
            studyId={task.studyId || undefined}
          />
        </div>
      </div>
    </div>
  );
}

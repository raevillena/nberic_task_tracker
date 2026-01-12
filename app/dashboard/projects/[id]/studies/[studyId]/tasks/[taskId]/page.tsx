// Task detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTaskByIdThunk, updateTaskThunk, deleteTaskThunk } from '@/store/slices/taskSlice';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import Link from 'next/link';
import { TaskChat } from '@/components/tasks/TaskChat';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projectId = parseInt(params.id as string, 10);
  const studyId = parseInt(params.studyId as string, 10);
  const taskId = parseInt(params.taskId as string, 10);

  const task = useAppSelector((state) =>
    taskId && !isNaN(taskId) ? state.task.entities[taskId] : undefined
  );
  const isLoading = useAppSelector((state) => state.task.isLoading);
  const isUpdating = useAppSelector((state) => state.task.isUpdating);
  const isDeleting = useAppSelector((state) => state.task.isDeleting);
  const error = useAppSelector((state) => state.task.error);
  const { user } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [editStatus, setEditStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId && !isNaN(taskId) && projectId && !isNaN(projectId) && studyId && !isNaN(studyId)) {
      // Only fetch if task is not already in state
      if (!task) {
        dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
      } else {
        // Initialize edit form with current task data
        setEditName(task.name);
        setEditDescription(task.description || '');
        setEditPriority(task.priority);
        setEditStatus(task.status);
      }
    }
  }, [dispatch, taskId, projectId, studyId, task]);

  // Update edit form when task changes
  useEffect(() => {
    if (task) {
      setEditName(task.name);
      setEditDescription(task.description || '');
      setEditPriority(task.priority);
      setEditStatus(task.status);
    }
  }, [task]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editName.trim()) {
      setFormError('Task name is required');
      return;
    }

    // Researchers can only update name, description, and status (not to completed)
    if (user?.role === UserRole.RESEARCHER && editStatus === TaskStatus.COMPLETED) {
      setFormError('Researchers cannot mark tasks as completed. Use the complete button instead.');
      return;
    }

    const updateData: any = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    };

    // Only managers can update priority
    if (user?.role === UserRole.MANAGER) {
      updateData.priority = editPriority;
    }

    // Update status (researchers can update to in_progress, managers can update to any)
    if (user?.role === UserRole.MANAGER || editStatus !== TaskStatus.COMPLETED) {
      updateData.status = editStatus;
    }

    const result = await dispatch(
      updateTaskThunk({
        projectId,
        studyId,
        taskId,
        taskData: updateData,
      })
    );

    if (updateTaskThunk.fulfilled.match(result)) {
      setIsEditing(false);
      // Refresh task data
      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
    } else {
      setFormError(result.payload as string || 'Failed to update task');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    const result = await dispatch(
      deleteTaskThunk({
        projectId,
        studyId,
        taskId,
      })
    );

    if (deleteTaskThunk.fulfilled.match(result)) {
      router.push(`/dashboard/projects/${projectId}/studies/${studyId}`);
    }
  };

  const handleComplete = async () => {
    const result = await dispatch(
      updateTaskThunk({
        projectId,
        studyId,
        taskId,
        taskData: {
          status: TaskStatus.COMPLETED,
        },
      })
    );

    if (updateTaskThunk.fulfilled.match(result)) {
      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
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
        <Link href={`/dashboard/projects/${projectId}/studies/${studyId}`} className="text-indigo-600 hover:text-indigo-700">
          Back to Study
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Task not found</p>
        <Link href={`/dashboard/projects/${projectId}/studies/${studyId}`} className="text-indigo-600 hover:text-indigo-700">
          Back to Study
        </Link>
      </div>
    );
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

  const canEdit = user?.role === UserRole.MANAGER || (user?.role === UserRole.RESEARCHER && task.assignedToId === user.id);
  const canDelete = user?.role === UserRole.MANAGER;
  const canComplete = (user?.role === UserRole.MANAGER || (user?.role === UserRole.RESEARCHER && task.assignedToId === user.id)) && task.status !== TaskStatus.COMPLETED;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/projects/${projectId}/studies/${studyId}`}
          className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block"
        >
          ← Back to Study
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
                {user?.role === UserRole.MANAGER && (
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
                )}
                <div>
                  <label htmlFor="editStatus" className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isUpdating || (user?.role === UserRole.RESEARCHER && editStatus === TaskStatus.COMPLETED)}
                  >
                    <option value={TaskStatus.PENDING}>Pending</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    {user?.role === UserRole.MANAGER && (
                      <>
                        <option value={TaskStatus.COMPLETED}>Completed</option>
                        <option value={TaskStatus.CANCELLED}>Cancelled</option>
                      </>
                    )}
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
                      setEditName(task.name);
                      setEditDescription(task.description || '');
                      setEditPriority(task.priority);
                      setEditStatus(task.status);
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.name}</h1>
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
                </div>
              </>
            )}
          </div>
          {!isEditing && (
            <div className="flex space-x-2">
              {canComplete && (
                <button
                  onClick={handleComplete}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Complete
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

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Project</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <Link
                  href={`/dashboard/projects/${projectId}`}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  {task.study?.project?.name || 'Unknown Project'}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Study</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <Link
                  href={`/dashboard/projects/${projectId}/studies/${studyId}`}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  {task.study?.name || 'Unknown Study'}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {task.assignedTo ? (
                  `${task.assignedTo.firstName} ${task.assignedTo.lastName} (${task.assignedTo.email})`
                ) : (
                  <span className="text-gray-400">Unassigned</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created By</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {task.createdBy
                  ? `${task.createdBy.firstName} ${task.createdBy.lastName} (${task.createdBy.email})`
                  : 'Unknown'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Due Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }) : (
                  <span className="text-gray-400">No due date</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(task.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
            {task.completedAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Completed At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(task.completedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
            )}
            {task.completedBy && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Completed By</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {`${task.completedBy.firstName} ${task.completedBy.lastName} (${task.completedBy.email})`}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Task Chat/Thread */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="h-[500px]">
          <TaskChat
            taskId={taskId}
            taskName={task.name}
            projectId={projectId}
            studyId={studyId}
          />
        </div>
      </div>
    </div>
  );
}

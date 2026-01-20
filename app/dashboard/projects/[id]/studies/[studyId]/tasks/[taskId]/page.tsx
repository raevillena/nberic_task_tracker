// Task detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTaskByIdThunk, updateTaskThunk, deleteTaskThunk } from '@/store/slices/taskSlice';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import Link from 'next/link';
import { TaskChat } from '@/components/tasks/TaskChat';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { getReferrer } = useNavigationHistory();
  const projectId = parseInt(params.id as string, 10);
  const studyId = parseInt(params.studyId as string, 10);
  const taskId = parseInt(params.taskId as string, 10);
  
  // Get back URL - check if came from tasks list or study page
  const backUrl = getReferrer(
    pathname,
    `/dashboard/projects/${projectId}/studies/${studyId}`
  );

  const task = useAppSelector((state) =>
    taskId && !isNaN(taskId) ? state.task.entities[taskId] : undefined
  );

  // Build breadcrumbs based on where user came from
  const breadcrumbItems = (() => {
    if (typeof window === 'undefined') return [];
    
    const referrer = sessionStorage.getItem(`referrer:${pathname}`);
    const items = [];
    
    if (referrer === '/dashboard/tasks') {
      // Came from all tasks page
      items.push(
        { label: 'All Tasks', href: '/dashboard/tasks' },
        { label: task?.name || 'Task', href: '#' }
      );
    } else {
      // Came from study page or project page - show full hierarchy
      items.push(
        { label: 'Projects', href: '/dashboard/projects' },
        { label: task?.study?.project?.name || 'Project', href: `/dashboard/projects/${projectId}` },
        { label: task?.study?.name || 'Study', href: `/dashboard/projects/${projectId}/studies/${studyId}` },
        { label: task?.name || 'Task', href: '#' }
      );
    }
    
    return items;
  })();
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
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<number[]>([]); // Multiple assignments for managers
  const [editDueDate, setEditDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignUserId, setReassignUserId] = useState<number | ''>('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [researchers, setResearchers] = useState<Array<{ id: number; email: string; firstName: string; lastName: string }>>([]);
  const [loadingResearchers, setLoadingResearchers] = useState(false);

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
        // Initialize assignment: get assigned researchers (both legacy and many-to-many)
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
  }, [dispatch, taskId, projectId, studyId, task]);

  // Update edit form when task changes
  useEffect(() => {
    if (task) {
      setEditName(task.name);
      setEditDescription(task.description || '');
      setEditPriority(task.priority);
      setEditStatus(task.status);
      // Update assignment: get assigned researchers (both legacy and many-to-many)
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
      fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        // Silently fail - this is not critical
        console.error('Failed to mark task as read:', error);
      });
    }
  }, [task, taskId, projectId, studyId, user]);

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

    // Only managers can update priority, due date, and assignment
    if (user?.role === UserRole.MANAGER) {
      updateData.priority = editPriority;
      updateData.dueDate = editDueDate || null;
      // For single assignment, use the first selected user (legacy support)
      if (editAssignedUserIds.length > 0) {
        updateData.assignedToId = editAssignedUserIds[0];
      } else {
        updateData.assignedToId = null;
      }
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
      // If manager changed assignments, update multiple assignments via assign endpoint
      if (user?.role === UserRole.MANAGER && task) {
        // Get current assignments to compare
        const currentAssignedIds: number[] = [];
        if (task.assignedToId) {
          currentAssignedIds.push(task.assignedToId);
        }
        if (task.assignedResearchers && Array.isArray(task.assignedResearchers)) {
          task.assignedResearchers.forEach((r) => {
            if (!currentAssignedIds.includes(r.id)) {
              currentAssignedIds.push(r.id);
            }
          });
        }
        
        // Check if assignments changed
        const assignmentsChanged = 
          editAssignedUserIds.length !== currentAssignedIds.length ||
          !editAssignedUserIds.every((id) => currentAssignedIds.includes(id)) ||
          !currentAssignedIds.every((id) => editAssignedUserIds.includes(id));
        
        if (assignmentsChanged) {
          if (editAssignedUserIds.length > 0) {
            // Update assignments via assign endpoint
            try {
              await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userIds: editAssignedUserIds }),
              });
            } catch (error) {
              console.error('Failed to update task assignments:', error);
              // Continue anyway - task was updated
            }
          } else {
            // Clear all assignments - assignedToId is already set to null in updateData
            // Also clear TaskAssignment records by calling assign with a single null user
            // Actually, we can't use empty array, so we'll just rely on assignedToId = null
            // The TaskAssignment records will remain but assignedToId will be null
            // This is acceptable - the task will show as unassigned
          }
        }
      }
      
      setIsEditing(false);
      // Refresh task data
      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
    } else {
      setFormError(result.payload as string || 'Failed to update task');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to move this task to trash? It can be restored later from the Trash page.')) {
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
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to complete task');
        return;
      }

      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
    } catch (error) {
      setFormError('Failed to complete task');
    }
  };

  // Load researchers for reassignment dialog
  useEffect(() => {
    if (showReassignDialog && researchers.length === 0) {
      fetch('/api/users/researchers', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            // Filter out current user
            setResearchers(data.data.filter((r: any) => r.id !== user?.id));
          }
        })
        .catch((err) => {
          console.error('Failed to fetch researchers:', err);
        });
    }
  }, [showReassignDialog, researchers.length, user?.id]);


  const handleRequestCompletion = async () => {
    setIsRequesting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/request-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to request completion');
        return;
      }

      alert('Completion request submitted. Waiting for manager approval.');
      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
    } catch (error) {
      setFormError('Failed to request completion');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestReassignment = async () => {
    if (!reassignUserId || isNaN(reassignUserId as number)) {
      setFormError('Please select a researcher to reassign to');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/request-reassignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestedAssignedToId: reassignUserId,
          notes: reassignNotes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || 'Failed to request reassignment');
        return;
      }

      alert('Reassignment request submitted. Waiting for manager approval.');
      setShowReassignDialog(false);
      setReassignUserId('');
      setReassignNotes('');
      dispatch(fetchTaskByIdThunk({ projectId, studyId, taskId }));
    } catch (error) {
      setFormError('Failed to request reassignment');
    } finally {
      setIsRequesting(false);
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

  // Check if researcher is assigned (legacy or new many-to-many)
  const isAssigned = user?.role === UserRole.RESEARCHER && (
    task.assignedToId === user.id ||
    (task.assignedResearchers && task.assignedResearchers.some((r) => r.id === user.id))
  );
  
  const canEdit = user?.role === UserRole.MANAGER; // Only managers can edit tasks
  const canDelete = user?.role === UserRole.MANAGER;
  const canRequestCompletion = isAssigned && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED;
  const canRequestReassignment = isAssigned && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED;
  // Only managers can mark tasks as complete
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
                {user?.role === UserRole.MANAGER && (
                  <>
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
                  </>
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
                      // Reset assignment to current task assignments
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
            <div className="flex flex-wrap gap-2">
              {canRequestCompletion && (
                <button
                  onClick={handleRequestCompletion}
                  disabled={isRequesting || isUpdating}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isRequesting ? 'Requesting...' : 'Request Completion'}
                </button>
              )}
              {canRequestReassignment && (
                <button
                  onClick={() => setShowReassignDialog(true)}
                  disabled={isRequesting || isUpdating}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  Request Reassignment
                </button>
              )}
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
                  {isDeleting ? 'Moving to Trash...' : 'Move to Trash'}
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
                {task.assignedResearchers && task.assignedResearchers.length > 0 ? (
                  <div className="space-y-1">
                    {task.assignedResearchers.map((researcher) => (
                      <div key={researcher.id}>
                        {researcher.firstName} {researcher.lastName} ({researcher.email})
                      </div>
                    ))}
                  </div>
                ) : task.assignedTo ? (
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

      {/* Reassignment Request Dialog */}
      {showReassignDialog && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Request Reassignment</h2>
                <button
                  onClick={() => {
                    setShowReassignDialog(false);
                    setReassignUserId('');
                    setReassignNotes('');
                    setFormError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="reassignUser" className="block text-sm font-medium text-gray-700 mb-2">
                    Reassign To <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="reassignUser"
                    value={reassignUserId}
                    onChange={(e) => setReassignUserId(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isRequesting}
                  >
                    <option value="">Select a researcher...</option>
                    {researchers.map((researcher) => (
                      <option key={researcher.id} value={researcher.id}>
                        {researcher.firstName} {researcher.lastName} ({researcher.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="reassignNotes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="reassignNotes"
                    value={reassignNotes}
                    onChange={(e) => setReassignNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Reason for reassignment request..."
                    disabled={isRequesting}
                  />
                </div>

                {formError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={handleRequestReassignment}
                    disabled={isRequesting || !reassignUserId}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRequesting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReassignDialog(false);
                      setReassignUserId('');
                      setReassignNotes('');
                      setFormError(null);
                    }}
                    disabled={isRequesting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

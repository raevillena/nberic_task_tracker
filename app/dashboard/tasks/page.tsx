// Tasks list page

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllTasksThunk, selectAllTasks, createTaskThunk } from '@/store/slices/taskSlice';
import { fetchProjectsThunk, selectAllProjects } from '@/store/slices/projectSlice';
import { fetchStudiesByProjectThunk, selectStudiesByProjectId } from '@/store/slices/studySlice';
import { addNotification } from '@/store/slices/notificationSlice';
import { TaskStatus, TaskPriority, User, Study } from '@/types/entities';
import Link from 'next/link';

// Stable empty array to prevent unnecessary rerenders
const EMPTY_STUDIES: Study[] = [];

export default function TasksPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const tasks = useAppSelector(selectAllTasks);
  const projects = useAppSelector(selectAllProjects);
  const isLoading = useAppSelector((state) => state.task.isLoading);
  const isCreating = useAppSelector((state) => state.task.isCreating);
  const isLoadingProjects = useAppSelector((state) => state.project.isLoading);
  const isLoadingStudies = useAppSelector((state) => state.study.isLoading);
  const { user } = useAppSelector((state) => state.auth);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedStudyId, setSelectedStudyId] = useState<number | ''>('');
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [assignedToId, setAssignedToId] = useState<number | ''>(''); // Legacy single assignment
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]); // Multiple assignments
  const [dueDate, setDueDate] = useState('');
  const [researchers, setResearchers] = useState<User[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingResearchers, setLoadingResearchers] = useState(false);

  useEffect(() => {
    dispatch(fetchAllTasksThunk());
    dispatch(fetchProjectsThunk());
  }, [dispatch]);

  // Load studies when project is selected
  useEffect(() => {
    if (selectedProjectId && !isNaN(selectedProjectId as number)) {
      dispatch(fetchStudiesByProjectThunk(selectedProjectId as number));
      // Reset study selection when project changes
      setSelectedStudyId('');
    }
  }, [selectedProjectId, dispatch]);

  // Fetch researchers when modal opens
  useEffect(() => {
    if (showCreateModal && researchers.length === 0 && !loadingResearchers) {
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
  }, [showCreateModal, researchers.length, loadingResearchers]);

  // Get studies for selected project
  const availableStudies = useAppSelector((state) =>
    selectedProjectId && !isNaN(selectedProjectId as number)
      ? selectStudiesByProjectId(state, selectedProjectId as number)
      : EMPTY_STUDIES
  );

  // Helper functions for status and priority styling
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

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProjectId || selectedProjectId === '') {
      setFormError('Please select a project');
      return;
    }

    if (!selectedStudyId || selectedStudyId === '') {
      setFormError('Please select a study');
      return;
    }

    if (!taskName.trim()) {
      setFormError('Task name is required');
      return;
    }

    // Create task first, then assign if researchers selected
    const result = await dispatch(
      createTaskThunk({
        studyId: selectedStudyId as number,
        taskData: {
          name: taskName.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          assignedToId: assignedUserIds.length > 0 ? assignedUserIds[0] : (assignedToId ? (assignedToId as number) : undefined),
          dueDate: dueDate || undefined,
        },
      })
    );

    if (createTaskThunk.fulfilled.match(result)) {
      const task = result.payload;
      const projectId = availableStudies.find((s) => s.id === selectedStudyId)?.projectId;
      
      // Assign to researchers if selected
      if (assignedUserIds.length > 0 && task && task.id && projectId) {
        try {
          await fetch(`/api/projects/${projectId}/studies/${selectedStudyId}/tasks/${task.id}/assign`, {
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
      dispatch(fetchAllTasksThunk());
      // Close modal and reset form
      setShowCreateModal(false);
      setSelectedProjectId('');
      setSelectedStudyId('');
      setTaskName('');
      setTaskDescription('');
      setTaskPriority(TaskPriority.MEDIUM);
      setAssignedToId('');
      setAssignedUserIds([]);
      setDueDate('');
      setFormError(null);
      
      // Navigate to the task detail page if available
      if (task && task.id && projectId) {
        router.push(`/dashboard/projects/${projectId}/studies/${task.studyId}/tasks/${task.id}`);
      }
    } else {
      setFormError(result.payload as string || 'Failed to create task');
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'Manager'
              ? 'View and manage all tasks across projects and studies'
              : 'View your assigned tasks'}
          </p>
        </div>
        {user?.role === 'Manager' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Task
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
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
            {user?.role === 'Manager'
              ? 'Create tasks within studies to get started.'
              : 'No tasks have been assigned to you yet.'}
          </p>
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
                    Project / Study
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
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {!(task as any).isRead && (
                          <div className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0" title="Unread" />
                        )}
                        <Link
                          href={`/dashboard/projects/${task.study?.project?.id || ''}/studies/${task.studyId}/tasks/${task.id}`}
                          className={`text-sm font-medium hover:text-indigo-900 ${
                            !(task as any).isRead ? 'text-indigo-700 font-semibold' : 'text-indigo-600'
                          }`}
                        >
                          {task.name}
                        </Link>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {task.study?.project?.name || 'Unknown Project'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {task.study?.name || 'Unknown Study'}
                      </div>
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
                      {formatDate(task.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Task</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedProjectId('');
                    setSelectedStudyId('');
                    setTaskName('');
                    setTaskDescription('');
                    setTaskPriority(TaskPriority.MEDIUM);
                    setAssignedToId('');
                    setDueDate('');
                    setFormError(null);
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
                  <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="project"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value, 10) : '')}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={isCreating || isLoadingProjects}
                    >
                      <option value="">
                        {isLoadingProjects ? 'Loading projects...' : 'Select a project'}
                      </option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingProjects && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="study" className="block text-sm font-medium text-gray-700 mb-2">
                    Study <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="study"
                      value={selectedStudyId}
                      onChange={(e) => setSelectedStudyId(e.target.value ? parseInt(e.target.value, 10) : '')}
                      required
                      disabled={!selectedProjectId || isCreating || isLoadingStudies}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedProjectId 
                          ? 'Select a project first' 
                          : isLoadingStudies 
                          ? 'Loading studies...' 
                          : 'Select a study'}
                      </option>
                      {availableStudies.map((study) => (
                        <option key={study.id} value={study.id}>
                          {study.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingStudies && selectedProjectId && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>
                </div>

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
                    disabled={isCreating}
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
                    disabled={isCreating}
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
                    disabled={isCreating}
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
                            disabled={isCreating}
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
                    type="date"
                    id="dueDate"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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
                      setSelectedStudyId('');
                      setTaskName('');
                      setTaskDescription('');
                      setTaskPriority(TaskPriority.MEDIUM);
                      setAssignedToId('');
                      setAssignedUserIds([]);
                      setDueDate('');
                      setFormError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !selectedProjectId || !selectedStudyId || !taskName.trim() || isLoadingProjects || isLoadingStudies}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Create Task</span>
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

// Task requests page for managers to approve/reject requests

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { UserRole, TaskRequestType, TaskRequestStatus } from '@/types/entities';
import Link from 'next/link';

interface TaskRequest {
  id: number;
  taskId: number;
  requestedById: number;
  requestType: TaskRequestType;
  requestedAssignedToId: number | null;
  status: TaskRequestStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  task?: {
    id: number;
    name: string;
    studyId: number;
    study?: {
      id: number;
      name: string;
      projectId: number;
      project?: {
        id: number;
        name: string;
      };
    };
  };
  requestedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  requestedAssignedTo?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const REJECTION_REASONS = [
  'Task requirements not met',
  'Insufficient information provided',
  'Task needs revision',
  'Not aligned with project goals',
  'Timeline constraints',
  'Resource unavailability',
  'Other',
] as const;

export default function RequestsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/task-requests', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      let filtered = data.data || [];
      
      if (filter !== 'all') {
        filtered = filtered.filter((r: TaskRequest) => r.status === filter);
      }
      
      setRequests(filtered);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user?.role === UserRole.MANAGER) {
      fetchRequests();
    }
  }, [user, fetchRequests]);

  // Listen for new task requests via socket
  useEffect(() => {
    if (user?.role !== UserRole.MANAGER) return;

    // Import socket client dynamically to avoid SSR issues
    import('@/lib/socket/client').then(({ getSocket }) => {
      const socket = getSocket();
      if (!socket) return;

      const handleNewRequest = (data?: any) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e852ecc4-6e60-4763-9b73-f1b441565d96',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'requests/page.tsx:handleNewRequest',message:'Socket event received',data:{requestId:data?.request?.id,taskCreatedById:data?.task?.createdById,currentUserId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        // Refresh requests when a new one is created
        fetchRequests();
      };

      socket.on('task-request:created', handleNewRequest);
      socket.on('task-request:approved', handleNewRequest);
      socket.on('task-request:rejected', handleNewRequest);

      return () => {
        socket.off('task-request:created', handleNewRequest);
        socket.off('task-request:approved', handleNewRequest);
        socket.off('task-request:rejected', handleNewRequest);
      };
    }).catch(() => {
      // Socket not available, that's okay
    });
  }, [user, fetchRequests]);

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`/api/task-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to approve request:', error);
        
        // Check if task was already completed
        const request = requests.find((r) => r.id === requestId);
        if (request?.requestType === TaskRequestType.COMPLETION && error.message?.includes('already completed')) {
          // Task was already completed - still try to refresh to see updated status
          await fetchRequests();
          alert('This task was already completed. The request has been approved.');
          return;
        }
        
        alert(error.message || 'Failed to approve request');
        return;
      }

      const result = await response.json();
      console.log('Request approved successfully:', result);
      
      // Check if task was already completed (from response or task status)
      const request = requests.find((r) => r.id === requestId);
      if (request?.requestType === TaskRequestType.COMPLETION && result.data?.task?.status === 'completed') {
        // Check if task was already completed before this approval
        const wasAlreadyCompleted = result.data.task.completedAt && 
          new Date(result.data.task.completedAt).getTime() < new Date(result.data.request.reviewedAt).getTime() - 1000;
        
        if (wasAlreadyCompleted) {
          alert('Note: This task was already completed. The request has been approved.');
        }
      }
      
      // Refresh requests list
      await fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (requestId: number) => {
    setRejectingRequestId(requestId);
    setSelectedReason('');
    setCustomReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingRequestId) return;

    // Validate: If "Other" is selected, custom reason is required
    if (selectedReason === 'Other' && !customReason.trim()) {
      alert('Please provide a reason when selecting "Other"');
      return;
    }

    // Require at least one reason to be selected
    if (!selectedReason) {
      alert('Please select a reason for rejection');
      return;
    }

    // Build rejection notes from selected reason and custom reason
    let rejectionNotes = '';
    if (selectedReason === 'Other') {
      rejectionNotes = customReason.trim();
    } else {
      rejectionNotes = selectedReason;
      if (customReason.trim()) {
        rejectionNotes += ` - ${customReason.trim()}`;
      }
    }

    setRejectDialogOpen(false);
    setProcessingId(rejectingRequestId);

    try {
      const response = await fetch(`/api/task-requests/${rejectingRequestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: rejectionNotes }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Failed to reject request');
        return;
      }

      await fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
      setRejectingRequestId(null);
      setSelectedReason('');
      setCustomReason('');
    }
  };

  const handleRejectCancel = () => {
    setRejectDialogOpen(false);
    setRejectingRequestId(null);
    setSelectedReason('');
    setCustomReason('');
  };

  if (user?.role !== UserRole.MANAGER) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Task Requests</h1>
        <p className="text-gray-600 mt-2">Review and approve/reject task completion and reassignment requests</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex space-x-4 border-b border-gray-200">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === f
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600">No {filter === 'all' ? '' : filter} requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-600"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      request.status === TaskRequestStatus.PENDING
                        ? 'bg-yellow-100 text-yellow-800'
                        : request.status === TaskRequestStatus.APPROVED
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      request.requestType === TaskRequestType.COMPLETION
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {request.requestType === TaskRequestType.COMPLETION ? 'Completion Request' : 'Reassignment Request'}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {request.task?.name || `Task #${request.taskId}`}
                  </h3>

                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Requested by:</span>{' '}
                      {request.requestedBy
                        ? `${request.requestedBy.firstName} ${request.requestedBy.lastName} (${request.requestedBy.email})`
                        : 'Unknown'}
                    </p>
                    {request.requestType === TaskRequestType.REASSIGNMENT && request.requestedAssignedTo && (
                      <p>
                        <span className="font-medium">Reassign to:</span>{' '}
                        {request.requestedAssignedTo.firstName} {request.requestedAssignedTo.lastName} ({request.requestedAssignedTo.email})
                      </p>
                    )}
                    {request.notes && (
                      <p>
                        <span className="font-medium">Notes:</span> {request.notes}
                      </p>
                    )}
                    {request.reviewedBy && (
                      <p>
                        <span className="font-medium">Reviewed by:</span>{' '}
                        {request.reviewedBy.firstName} {request.reviewedBy.lastName} on{' '}
                        {new Date(request.reviewedAt!).toLocaleString()}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Requested:</span>{' '}
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {request.task?.study?.project && (
                    <div className="mt-3">
                      <Link
                        href={`/dashboard/projects/${request.task.study.project.id}/studies/${request.task.study.id}/tasks/${request.task.id}`}
                        className="text-indigo-600 hover:text-indigo-700 text-sm"
                      >
                        View Task →
                      </Link>
                    </div>
                  )}
                </div>

                {request.status === TaskRequestStatus.PENDING && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === request.id 
                        ? 'Processing...' 
                        : request.requestType === TaskRequestType.COMPLETION
                        ? 'Mark as Completed'
                        : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectClick(request.id)}
                      disabled={processingId === request.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {processingId === request.id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectDialogOpen && (
        <div 
          className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50"
          onClick={handleRejectCancel}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reject Request</h2>
                <button
                  onClick={handleRejectCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {REJECTION_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="rejectionReason"
                          value={reason}
                          checked={selectedReason === reason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="customReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="customReason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Provide additional details..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={handleRejectCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!selectedReason || (selectedReason === 'Other' && !customReason.trim())}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Request
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

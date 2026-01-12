// About page

'use client';

import { useAppSelector } from '@/store/hooks';

export default function AboutPage() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">About NBERIC Task Tracker</h1>
        <p className="text-gray-600">Learn more about the application and its features</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            NBERIC Task Tracker is a comprehensive project management system designed for research teams.
            It helps you organize projects, studies, and tasks efficiently, track progress, and collaborate
            effectively with your team members.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Key Features</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Project Management:</strong> Create and manage research projects with detailed descriptions and progress tracking.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Study Organization:</strong> Organize studies within projects and track their individual progress.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Task Assignment:</strong> Assign tasks to team members and track completion status.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Progress Tracking:</strong> Automatic progress calculation from tasks to studies to projects.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Role-Based Access:</strong> Different permissions for Managers and Researchers to ensure proper access control.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Compliance Tracking:</strong> Flag and track compliance issues for tasks and studies.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Roles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-indigo-50 rounded-lg">
              <h3 className="font-semibold text-indigo-900 mb-2">Manager</h3>
              <ul className="text-sm text-indigo-800 space-y-1">
                <li>• Create and manage projects</li>
                <li>• Create and manage studies</li>
                <li>• Create and assign tasks</li>
                <li>• View all projects and studies</li>
                <li>• Complete tasks</li>
                <li>• Manage compliance flags</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Researcher</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• View assigned projects and studies</li>
                <li>• View and update assigned tasks</li>
                <li>• Update task status (not to completed)</li>
                <li>• View compliance flags</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Account</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-600">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user?.firstName} {user?.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Role</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.role}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Support</h2>
          <p className="text-gray-700">
            If you have any questions or need assistance, please contact your system administrator
            or refer to the documentation.
          </p>
        </section>
      </div>
    </div>
  );
}

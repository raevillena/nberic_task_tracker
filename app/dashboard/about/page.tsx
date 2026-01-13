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
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Developer</h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Raymart O. Villena</h3>
                <p className="text-gray-700 mb-3">
                  Full-Stack Developer specializing in building scalable, production-ready applications.
                </p>
                <a
                  href="https://github.com/raevillena"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

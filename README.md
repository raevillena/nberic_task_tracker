# NBERIC Task Tracker

A comprehensive task tracking system built with Next.js, TypeScript, Sequelize, and MariaDB.

## Features

- **Project → Study → Task Hierarchy**: Organized task management structure
- **Role-Based Access Control (RBAC)**: Manager and Researcher roles with different permissions
- **Real-time Updates**: Socket.IO integration for live progress updates
- **Progress Tracking**: Automatic progress calculation from tasks to studies to projects
- **JWT Authentication**: Secure token-based authentication with refresh tokens

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **State Management**: Redux Toolkit
- **Backend**: Next.js API Routes
- **Database**: MariaDB with Sequelize ORM v7
- **Real-time**: Socket.IO
- **Authentication**: JWT (access + refresh tokens)

## Prerequisites

- Node.js 18+ 
- MariaDB 10.5+
- npm or yarn

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a MariaDB database:

```sql
CREATE DATABASE nberic_task_tracker;
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Update the following variables:
- `DB_HOST`: MariaDB host (default: localhost)
- `DB_PORT`: MariaDB port (default: 3306)
- `DB_NAME`: Database name (default: nberic_task_tracker)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `JWT_SECRET`: Strong random secret (minimum 32 characters)

### 4. Database Migrations

Run Sequelize migrations to create tables:

```bash
npm run db:migrate
```

### 5. Seed Database (Optional)

Create initial users and data:

```bash
npm run db:seed
```

### 6. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
nberic_task_tracker/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Protected dashboard routes
│   └── api/               # API routes
├── src/
│   ├── components/        # React components
│   ├── lib/              # Utilities and configurations
│   │   ├── auth/         # Authentication utilities
│   │   ├── db/           # Database models
│   │   ├── rbac/         # RBAC utilities
│   │   └── utils/        # General utilities
│   ├── services/         # Business logic layer
│   ├── store/            # Redux store and slices
│   ├── types/            # TypeScript type definitions
│   └── hooks/            # Custom React hooks
├── migrations/           # Sequelize migrations
└── seeders/             # Database seeders
```

## Roles and Permissions

### Manager
- Full CRUD on projects, studies, and tasks
- Can assign tasks to researchers
- Can mark tasks as complete
- Can view all projects and tasks

### Researcher
- Can view assigned projects, studies, and tasks
- Can update assigned tasks (limited fields)
- **Cannot** complete tasks
- **Cannot** assign tasks
- **Cannot** create/delete projects or studies

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project (Manager only)
- `GET /api/projects/[id]` - Get project by ID
- `PUT /api/projects/[id]` - Update project (Manager only)
- `DELETE /api/projects/[id]` - Delete project (Manager only)

### Studies
- `GET /api/projects/[id]/studies` - Get studies for project
- `POST /api/projects/[id]/studies` - Create study (Manager only)

### Tasks
- `GET /api/studies/[studyId]/tasks` - Get tasks for study
- `POST /api/studies/[studyId]/tasks` - Create task (Manager only)
- `POST /api/tasks/[taskId]/complete` - Complete task (Manager only)

## Progress Calculation

Progress is automatically calculated:
- **Task Progress**: 100% if completed, 0% otherwise
- **Study Progress**: (Completed Tasks / Total Tasks) × 100
- **Project Progress**: Average of all study progress values

Progress is cached in the database and recalculated when tasks are created, updated, or deleted.

## Development

### Running Migrations

```bash
# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:undo
```

### Type Checking

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm start
```

## Security Considerations

- JWT tokens with short-lived access tokens (15 minutes) and long-lived refresh tokens (7 days)
- Refresh tokens stored in httpOnly cookies
- Password hashing with bcrypt (12 salt rounds)
- RBAC enforcement at multiple layers
- SQL injection prevention via Sequelize parameterized queries

## Future Enhancements

- Task dependencies
- Task priorities and due dates
- File attachments
- Comments/notes on tasks
- Email notifications
- Activity logs/audit trail
- Advanced progress weighting

## License

Private - NBERIC Internal Use


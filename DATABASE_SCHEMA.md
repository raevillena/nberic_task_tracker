# Database Schema Design
## NBERIC Task Tracker - Sequelize Models & MariaDB Schema

**Status**: Core models implemented. Additional models planned for future implementation.

---

## Table of Contents
1. [Implemented Models](#implemented-models)
2. [Associations](#associations)
3. [Enums](#enums)
4. [Indexes](#indexes)
5. [Migration Strategy](#migration-strategy)
6. [Data Integrity Constraints](#data-integrity-constraints)
7. [Future Models](#future-models)

---

## Implemented Models

### 1. User Model

**Purpose**: Stores user authentication and role information.

**Location**: `src/lib/db/models/user.ts`

**Key Features**:
- JWT token versioning for refresh token invalidation
- Role-based access control (Manager/Researcher)
- Email uniqueness enforced at database level

```typescript
// src/lib/db/models/user.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { UserRole } from '@/types/entities';

interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  tokenVersion: number; // For JWT refresh token invalidation
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'lastLoginAt' | 'tokenVersion' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare firstName: string;
  declare lastName: string;
  declare role: UserRole;
  declare isActive: boolean;
  declare lastLoginAt: Date | null;
  declare tokenVersion: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // Password hashing handled in service layer (bcrypt)
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.RESEARCHER,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tokenVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      comment: 'Incremented on logout to invalidate all refresh tokens',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
        name: 'idx_users_email',
      },
      {
        fields: ['role'],
        name: 'idx_users_role',
      },
      {
        fields: ['is_active'],
        name: 'idx_users_is_active',
      },
    ],
  }
);
```

**Key Features**:
- Email uniqueness enforced at database level
- Role enum for RBAC (Manager/Researcher)
- Soft delete via `isActive` flag
- Tracks last login for security auditing
- **`tokenVersion` field**: Incremented on logout to invalidate all JWT refresh tokens (security feature)

---

### 2. Project Model

**Purpose**: Top-level container for studies and tasks.

**Location**: `src/lib/db/models/project.ts`

**Key Features**:
- Progress field cached for performance (0-100)
- Custom getter converts DECIMAL to number for JavaScript

```typescript
// src/lib/db/models/project.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface ProjectAttributes {
  id: number;
  name: string;
  description: string | null;
  progress: number; // 0-100, calculated from studies
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectCreationAttributes extends Optional<ProjectAttributes, 'id' | 'description' | 'progress' | 'createdAt' | 'updatedAt'> {}

export class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare progress: number;
  declare createdById: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    progress: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Calculated progress percentage (0-100)',
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Project',
    tableName: 'projects',
    underscored: true,
    indexes: [
      {
        fields: ['created_by_id'],
        name: 'idx_projects_created_by',
      },
      {
        fields: ['progress'],
        name: 'idx_projects_progress',
      },
      {
        fields: ['created_at'],
        name: 'idx_projects_created_at',
      },
    ],
  }
);
```

**Key Features**:
- Progress field cached for performance (recalculated on task changes)
- Custom getter converts DECIMAL to number for JavaScript compatibility
- Foreign key to User (creator) with RESTRICT on delete
- Indexes for common query patterns

---

### 3. Study Model

**Purpose**: Intermediate container between projects and tasks.

**Location**: `src/lib/db/models/study.ts`

**Key Features**:
- Progress field cached for performance (0-100)
- Custom getter converts DECIMAL to number for JavaScript
- CASCADE delete when project is deleted

```typescript
// src/lib/db/models/study.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface StudyAttributes {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  progress: number; // 0-100, calculated from tasks
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StudyCreationAttributes extends Optional<StudyAttributes, 'id' | 'description' | 'progress' | 'createdAt' | 'updatedAt'> {}

export class Study extends Model<StudyAttributes, StudyCreationAttributes> implements StudyAttributes {
  declare id: number;
  declare projectId: number;
  declare name: string;
  declare description: string | null;
  declare progress: number;
  declare createdById: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Study.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Parent project - cascades delete',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    progress: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100,
      },
      get() {
        const value = this.getDataValue('progress');
        return value ? parseFloat(value.toString()) : 0;
      },
      comment: 'Calculated progress percentage (0-100)',
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Study',
    tableName: 'studies',
    underscored: true,
    indexes: [
      {
        fields: ['project_id'],
        name: 'idx_studies_project',
      },
      {
        fields: ['created_by_id'],
        name: 'idx_studies_created_by',
      },
      {
        fields: ['progress'],
        name: 'idx_studies_progress',
      },
    ],
  }
);
```

**Key Features**:
- CASCADE delete when project is deleted
- Progress cached for performance (recalculated on task changes)
- Custom getter converts DECIMAL to number for JavaScript compatibility
- Index on projectId for efficient lookups

---

### 4. Task Model

**Purpose**: Individual work items assigned to researchers.

**Location**: `src/lib/db/models/task.ts`

**Key Features**:
- Status and priority enums for filtering and sorting
- Tracks both assignment (assignedToId) and completion (completedById) separately
- Composite index for common query pattern (study + status)

```typescript
// src/lib/db/models/task.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { TaskStatus, TaskPriority } from '@/types/entities';

interface TaskAttributes {
  id: number;
  studyId: number;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: number | null; // Researcher assigned to task
  createdById: number; // Manager who created task
  completedAt: Date | null;
  completedById: number | null; // Manager who marked complete
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskCreationAttributes extends Optional<TaskAttributes, 'id' | 'description' | 'status' | 'priority' | 'assignedToId' | 'completedAt' | 'completedById' | 'dueDate' | 'createdAt' | 'updatedAt'> {}

export class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  declare id: number;
  declare studyId: number;
  declare name: string;
  declare description: string | null;
  declare status: TaskStatus;
  declare priority: TaskPriority;
  declare assignedToId: number | null;
  declare createdById: number;
  declare completedAt: Date | null;
  declare completedById: number | null;
  declare dueDate: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Task.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    studyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Parent study - cascades delete',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TaskStatus)),
      allowNull: false,
      defaultValue: TaskStatus.PENDING,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(TaskPriority)),
      allowNull: false,
      defaultValue: TaskPriority.MEDIUM,
    },
    assignedToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Researcher assigned to task - set null if user deleted',
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Manager who created task',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when task was marked complete',
    },
    completedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Manager who marked task complete',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Optional due date for task',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    underscored: true,
    indexes: [
      {
        fields: ['study_id'],
        name: 'idx_tasks_study',
      },
      {
        fields: ['assigned_to_id'],
        name: 'idx_tasks_assigned_to',
      },
      {
        fields: ['status'],
        name: 'idx_tasks_status',
      },
      {
        fields: ['priority'],
        name: 'idx_tasks_priority',
      },
      {
        fields: ['created_by_id'],
        name: 'idx_tasks_created_by',
      },
      {
        fields: ['due_date'],
        name: 'idx_tasks_due_date',
      },
      {
        fields: ['study_id', 'status'],
        name: 'idx_tasks_study_status',
        comment: 'Composite index for filtering tasks by study and status',
      },
    ],
  }
);
```

**Key Features**:
- Status and priority enums for filtering and sorting
- Tracks both assignment (assignedToId) and completion (completedById) separately
- Composite index for common query pattern (study + status)
- SET NULL on assignedToId deletion (preserves task history)

---

## Summary of Implemented Models

**Currently Implemented (4 models)**:
1. ✅ **User** - Authentication, roles, JWT token versioning
2. ✅ **Project** - Top-level container with progress tracking
3. ✅ **Study** - Intermediate container with progress tracking
4. ✅ **Task** - Work items with status, priority, and assignments

**Location**: All models are in `src/lib/db/models/`

**Associations**: All relationships between these 4 models are configured in `src/lib/db/models/index.ts`

---

## Future Models

The following models are planned for future implementation:

### 5. ChatRoom Model

**Purpose**: Communication channels for projects, studies, or tasks.

```typescript
// src/lib/db/models/chatRoom.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export enum ChatRoomType {
  PROJECT = 'project',
  STUDY = 'study',
  TASK = 'task',
}

interface ChatRoomAttributes {
  id: number;
  name: string;
  type: ChatRoomType;
  projectId: number | null; // If type is PROJECT
  studyId: number | null; // If type is STUDY
  taskId: number | null; // If type is TASK
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatRoomCreationAttributes extends Optional<ChatRoomAttributes, 'id' | 'projectId' | 'studyId' | 'taskId' | 'createdAt' | 'updatedAt'> {}

export class ChatRoom extends Model<ChatRoomAttributes, ChatRoomCreationAttributes> implements ChatRoomAttributes {
  declare id: number;
  declare name: string;
  declare type: ChatRoomType;
  declare projectId: number | null;
  declare studyId: number | null;
  declare taskId: number | null;
  declare createdById: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ChatRoom.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(ChatRoomType)),
      allowNull: false,
    },
    projectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    studyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ChatRoom',
    tableName: 'chat_rooms',
    underscored: true,
    indexes: [
      {
        fields: ['type', 'project_id'],
        name: 'idx_chat_rooms_type_project',
        where: {
          project_id: { [sequelize.Op.ne]: null },
        },
      },
      {
        fields: ['type', 'study_id'],
        name: 'idx_chat_rooms_type_study',
        where: {
          study_id: { [sequelize.Op.ne]: null },
        },
      },
      {
        fields: ['type', 'task_id'],
        name: 'idx_chat_rooms_type_task',
        where: {
          task_id: { [sequelize.Op.ne]: null },
        },
      },
      {
        fields: ['created_by_id'],
        name: 'idx_chat_rooms_created_by',
      },
    ],
  }
);
```

**Key Features**:
- Polymorphic association pattern (type + nullable foreign keys)
- Partial indexes for efficient lookups by type
- CASCADE delete when parent entity is deleted

---

### 6. ChatMessage Model

**Purpose**: Individual messages within chat rooms.

```typescript
// src/lib/db/models/chatMessage.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface ChatMessageAttributes {
  id: number;
  chatRoomId: number;
  userId: number;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessageCreationAttributes extends Optional<ChatMessageAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class ChatMessage extends Model<ChatMessageAttributes, ChatMessageCreationAttributes> implements ChatMessageAttributes {
  declare id: number;
  declare chatRoomId: number;
  declare userId: number;
  declare message: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ChatMessage.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    chatRoomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'chat_rooms',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Message author - restrict delete to preserve history',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ChatMessage',
    tableName: 'chat_messages',
    underscored: true,
    indexes: [
      {
        fields: ['chat_room_id', 'created_at'],
        name: 'idx_chat_messages_room_created',
        comment: 'Composite index for fetching messages in chronological order',
      },
      {
        fields: ['user_id'],
        name: 'idx_chat_messages_user',
      },
    ],
  }
);
```

**Key Features**:
- Composite index on (chatRoomId, createdAt) for efficient chronological retrieval
- RESTRICT on user delete to preserve message history
- CASCADE delete when chat room is deleted

---

### 7. FileUpload Model

**Purpose**: File attachments associated with tasks.

```typescript
// src/lib/db/models/fileUpload.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface FileUploadAttributes {
  id: number;
  taskId: number;
  fileName: string;
  originalFileName: string;
  filePath: string; // Server file system path or S3 key
  mimeType: string;
  fileSize: number; // Bytes
  uploadedById: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FileUploadCreationAttributes extends Optional<FileUploadAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class FileUpload extends Model<FileUploadAttributes, FileUploadCreationAttributes> implements FileUploadAttributes {
  declare id: number;
  declare taskId: number;
  declare fileName: string;
  declare originalFileName: string;
  declare filePath: string;
  declare mimeType: string;
  declare fileSize: number;
  declare uploadedById: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FileUpload.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Stored filename (may be hashed/renamed)',
    },
    originalFileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Original filename from user upload',
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Full path to file (local or S3 key)',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      comment: 'File size in bytes',
    },
    uploadedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'FileUpload',
    tableName: 'file_uploads',
    underscored: true,
    indexes: [
      {
        fields: ['task_id'],
        name: 'idx_file_uploads_task',
      },
      {
        fields: ['uploaded_by_id'],
        name: 'idx_file_uploads_uploaded_by',
      },
      {
        fields: ['mime_type'],
        name: 'idx_file_uploads_mime_type',
      },
    ],
  }
);
```

**Key Features**:
- Stores both original and stored filenames
- Supports local filesystem or S3 storage (via filePath)
- Tracks file metadata (size, mime type) for validation

---

### 8. TaskActivityLog Model

**Purpose**: Audit trail for task changes and user actions.

```typescript
// src/lib/db/models/taskActivityLog.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export enum ActivityType {
  CREATED = 'created',
  UPDATED = 'updated',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
}

interface TaskActivityLogAttributes {
  id: number;
  taskId: number;
  userId: number;
  activityType: ActivityType;
  description: string | null;
  metadata: Record<string, any> | null; // JSON field for flexible data
  createdAt: Date;
}

interface TaskActivityLogCreationAttributes extends Optional<TaskActivityLogAttributes, 'id' | 'description' | 'metadata' | 'createdAt'> {}

export class TaskActivityLog extends Model<TaskActivityLogAttributes, TaskActivityLogCreationAttributes> implements TaskActivityLogAttributes {
  declare id: number;
  declare taskId: number;
  declare userId: number;
  declare activityType: ActivityType;
  declare description: string | null;
  declare metadata: Record<string, any> | null;
  declare readonly createdAt: Date;
}

TaskActivityLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'User who performed the action',
    },
    activityType: {
      type: DataTypes.ENUM(...Object.values(ActivityType)),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Human-readable description of the activity',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Flexible JSON field for storing additional activity data',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'TaskActivityLog',
    tableName: 'task_activity_logs',
    underscored: true,
    // No updatedAt - activity logs are immutable
    timestamps: false,
    indexes: [
      {
        fields: ['task_id', 'created_at'],
        name: 'idx_task_activity_logs_task_created',
        comment: 'Composite index for fetching activity logs chronologically',
      },
      {
        fields: ['user_id'],
        name: 'idx_task_activity_logs_user',
      },
      {
        fields: ['activity_type'],
        name: 'idx_task_activity_logs_activity_type',
      },
    ],
  }
);
```

**Key Features**:
- Immutable log entries (no updatedAt)
- JSON metadata field for flexible data storage
- Activity type enum for filtering
- Composite index for chronological retrieval

---

### 9. ComplianceFlag Model

**Purpose**: Tracks compliance issues or flags on tasks.

```typescript
// src/lib/db/models/complianceFlag.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export enum ComplianceFlagStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ComplianceFlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface ComplianceFlagAttributes {
  id: number;
  taskId: number;
  flagType: string; // e.g., 'data_quality', 'protocol_violation', 'missing_documentation'
  severity: ComplianceFlagSeverity;
  status: ComplianceFlagStatus;
  description: string;
  raisedById: number;
  resolvedById: number | null;
  resolvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ComplianceFlagCreationAttributes extends Optional<ComplianceFlagAttributes, 'id' | 'resolvedById' | 'resolvedAt' | 'notes' | 'createdAt' | 'updatedAt'> {}

export class ComplianceFlag extends Model<ComplianceFlagAttributes, ComplianceFlagCreationAttributes> implements ComplianceFlagAttributes {
  declare id: number;
  declare taskId: number;
  declare flagType: string;
  declare severity: ComplianceFlagSeverity;
  declare status: ComplianceFlagStatus;
  declare description: string;
  declare raisedById: number;
  declare resolvedById: number | null;
  declare resolvedAt: Date | null;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ComplianceFlag.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    flagType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type/category of compliance issue',
    },
    severity: {
      type: DataTypes.ENUM(...Object.values(ComplianceFlagSeverity)),
      allowNull: false,
      defaultValue: ComplianceFlagSeverity.MEDIUM,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ComplianceFlagStatus)),
      allowNull: false,
      defaultValue: ComplianceFlagStatus.OPEN,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    raisedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    resolvedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about resolution or dismissal',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ComplianceFlag',
    tableName: 'compliance_flags',
    underscored: true,
    indexes: [
      {
        fields: ['task_id'],
        name: 'idx_compliance_flags_task',
      },
      {
        fields: ['status'],
        name: 'idx_compliance_flags_status',
      },
      {
        fields: ['severity'],
        name: 'idx_compliance_flags_severity',
      },
      {
        fields: ['raised_by_id'],
        name: 'idx_compliance_flags_raised_by',
      },
      {
        fields: ['task_id', 'status'],
        name: 'idx_compliance_flags_task_status',
        comment: 'Composite index for filtering open flags by task',
      },
    ],
  }
);
```

**Key Features**:
- Tracks flag lifecycle (open → resolved/dismissed)
- Severity levels for prioritization
- Tracks who raised and resolved flags
- Composite index for common query pattern

---

## Associations

### Association Definitions

**Location**: `src/lib/db/models/index.ts`

```typescript
// src/lib/db/models/index.ts
import { User } from './user';
import { Project } from './project';
import { Study } from './study';
import { Task } from './task';

// User Associations
User.hasMany(Project, {
  foreignKey: 'createdById',
  as: 'createdProjects',
});

User.hasMany(Study, {
  foreignKey: 'createdById',
  as: 'createdStudies',
});

User.hasMany(Task, {
  foreignKey: 'assignedToId',
  as: 'assignedTasks',
});

User.hasMany(Task, {
  foreignKey: 'createdById',
  as: 'createdTasks',
});

User.hasMany(Task, {
  foreignKey: 'completedById',
  as: 'completedTasks',
});

// Project Associations
Project.belongsTo(User, {
  foreignKey: 'createdById',
  as: 'createdBy',
});

Project.hasMany(Study, {
  foreignKey: 'projectId',
  as: 'studies',
});

// Study Associations
Study.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
});

Study.belongsTo(User, {
  foreignKey: 'createdById',
  as: 'createdBy',
});

Study.hasMany(Task, {
  foreignKey: 'studyId',
  as: 'tasks',
});

// Task Associations
Task.belongsTo(Study, {
  foreignKey: 'studyId',
  as: 'study',
});

Task.belongsTo(User, {
  foreignKey: 'assignedToId',
  as: 'assignedTo',
});

Task.belongsTo(User, {
  foreignKey: 'createdById',
  as: 'createdBy',
});

Task.belongsTo(User, {
  foreignKey: 'completedById',
  as: 'completedBy',
});

export { User, Project, Study, Task };
```

### Association Summary

**Implemented Associations**:

| Parent Model | Relationship | Child Model | Foreign Key | Delete Behavior |
|--------------|--------------|-------------|-------------|-----------------|
| User | hasMany | Project | createdById | RESTRICT |
| User | hasMany | Study | createdById | RESTRICT |
| User | hasMany | Task | assignedToId | SET NULL |
| User | hasMany | Task | createdById | RESTRICT |
| User | hasMany | Task | completedById | SET NULL |
| Project | belongsTo | User | createdById | RESTRICT |
| Project | hasMany | Study | projectId | CASCADE |
| Study | belongsTo | Project | projectId | CASCADE |
| Study | belongsTo | User | createdById | RESTRICT |
| Study | hasMany | Task | studyId | CASCADE |
| Task | belongsTo | Study | studyId | CASCADE |
| Task | belongsTo | User | assignedToId | SET NULL |
| Task | belongsTo | User | createdById | RESTRICT |
| Task | belongsTo | User | completedById | SET NULL |

**Delete Behavior Rationale**:
- **CASCADE**: Child entities are dependent on parent (Study → Task, Project → Study)
- **RESTRICT**: Prevent deletion of entities with important relationships (User who created resources)
- **SET NULL**: Preserve history while allowing user deletion (assignedToId, completedById)

---

## Enums

### Enum Definitions

**Location**: `src/types/entities.ts`

All enums are centralized in the types file and imported by models.

#### Implemented Enums

```typescript
// src/types/entities.ts

export enum UserRole {
  MANAGER = 'Manager',
  RESEARCHER = 'Researcher',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}
```

#### Future Enums (for planned models)

```typescript
// Planned for future implementation

export enum ChatRoomType {
  PROJECT = 'project',
  STUDY = 'study',
  TASK = 'task',
}

export enum ActivityType {
  CREATED = 'created',
  UPDATED = 'updated',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
}

export enum ComplianceFlagStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ComplianceFlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

**Enum Storage**: MariaDB stores ENUMs as strings, providing:
- Type safety at database level
- Efficient storage (no joins required)
- Easy querying and filtering

---

## Indexes

### Index Strategy

Indexes are defined in model definitions above. Summary:

#### Primary Indexes
- All models: `id` (PRIMARY KEY, auto-increment)

#### Foreign Key Indexes
- All foreign keys are automatically indexed by MariaDB
- Additional composite indexes added for common query patterns

#### Performance-Critical Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `users` | `email` (UNIQUE) | Fast login lookups |
| `users` | `role` | Filter users by role |
| `users` | `is_active` | Filter active users |
| `projects` | `created_by_id` | Find projects by creator |
| `projects` | `progress` | Sort/filter by progress |
| `studies` | `project_id` | Find studies in project |
| `studies` | `progress` | Sort/filter by progress |
| `tasks` | `study_id` | Find tasks in study |
| `tasks` | `assigned_to_id` | Find tasks assigned to user |
| `tasks` | `status` | Filter by status |
| `tasks` | `priority` | Sort by priority |
| `tasks` | `created_by_id` | Find tasks by creator |
| `tasks` | `due_date` | Filter by due date |
| `tasks` | `study_id, status` (composite) | Filter tasks by study and status |

#### Index Recommendations

1. **Composite Indexes**: Used for common WHERE + ORDER BY patterns
2. **Partial Indexes**: Consider for ChatRoom type-based queries (if MariaDB version supports)
3. **Covering Indexes**: Not implemented initially, but can be added if query analysis shows benefit

---

## Migration Strategy

### Migration File Structure

**Current Migrations** (to be created):
```
migrations/
├── 0000000000001-create-users.js
├── 0000000000002-create-projects.js
├── 0000000000003-create-studies.js
└── 0000000000004-create-tasks.js
```

**Future Migrations** (planned):
```
migrations/
├── 0000000000005-create-chat-rooms.js
├── 0000000000006-create-chat-messages.js
├── 0000000000007-create-file-uploads.js
├── 0000000000008-create-task-activity-logs.js
└── 0000000000009-create-compliance-flags.js
```

### Migration Execution Order

**Critical**: Execute migrations in dependency order:

**Currently Required (4 migrations)**:
1. **Users** (no dependencies)
2. **Projects** (depends on Users)
3. **Studies** (depends on Projects, Users)
4. **Tasks** (depends on Studies, Users)

**Future Migrations** (not yet implemented):
5. **ChatRooms** (depends on Projects, Studies, Tasks, Users)
6. **ChatMessages** (depends on ChatRooms, Users)
7. **FileUploads** (depends on Tasks, Users)
8. **TaskActivityLogs** (depends on Tasks, Users)
9. **ComplianceFlags** (depends on Tasks, Users)

### Example Migration File

```javascript
// migrations/0000000000004-create-tasks.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      study_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'studies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      assigned_to_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    });

    // Create indexes
    await queryInterface.addIndex('tasks', ['study_id'], {
      name: 'idx_tasks_study',
    });

    await queryInterface.addIndex('tasks', ['assigned_to_id'], {
      name: 'idx_tasks_assigned_to',
    });

    await queryInterface.addIndex('tasks', ['status'], {
      name: 'idx_tasks_status',
    });

    await queryInterface.addIndex('tasks', ['priority'], {
      name: 'idx_tasks_priority',
    });

    await queryInterface.addIndex('tasks', ['created_by_id'], {
      name: 'idx_tasks_created_by',
    });

    await queryInterface.addIndex('tasks', ['due_date'], {
      name: 'idx_tasks_due_date',
    });

    await queryInterface.addIndex('tasks', ['study_id', 'status'], {
      name: 'idx_tasks_study_status',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tasks');
  },
};
```

### Migration Best Practices

1. **Idempotency**: Migrations should be safe to run multiple times
2. **Rollback Support**: Always implement `down()` method
3. **Data Migration**: Use separate migrations for data transformations
4. **Index Creation**: Create indexes after table creation for better performance
5. **Foreign Keys**: Add foreign keys after all referenced tables exist

### Running Migrations

```bash
# Development
npx sequelize-cli db:migrate

# Production (with backup)
npx sequelize-cli db:migrate --env production

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all migrations
npx sequelize-cli db:migrate:undo:all
```

---

## Data Integrity Constraints

### Foreign Key Constraints

All foreign keys enforce referential integrity:
- **CASCADE**: Automatically delete/update child records
- **RESTRICT**: Prevent parent deletion if children exist
- **SET NULL**: Set foreign key to NULL when parent is deleted

### Check Constraints (MariaDB 10.2+)

Consider adding check constraints for data validation:

```sql
-- Example: Ensure progress is between 0 and 100
ALTER TABLE projects
ADD CONSTRAINT chk_projects_progress_range
CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE studies
ADD CONSTRAINT chk_studies_progress_range
CHECK (progress >= 0 AND progress <= 100);
```

### Unique Constraints

- `users.email`: Unique email addresses
- Composite unique constraints can be added if needed (e.g., unique task name per study)

### Not Null Constraints

Critical fields are marked `allowNull: false`:
- User: email, passwordHash, firstName, lastName, role
- Project: name, createdById
- Study: name, projectId, createdById
- Task: name, studyId, status, priority, createdById

---

## Performance Considerations

### Query Optimization

1. **Eager Loading**: Use `include` to load associations in single query
   ```typescript
   Task.findAll({
     include: [
       { model: Study, include: [{ model: Project }] },
       { model: User, as: 'assignedTo' },
     ],
   });
   ```

2. **Selective Fields**: Use `attributes` to limit returned columns
   ```typescript
   Task.findAll({
     attributes: ['id', 'name', 'status'],
   });
   ```

3. **Pagination**: Always paginate large result sets
   ```typescript
   Task.findAll({
     limit: 20,
     offset: 0,
   });
   ```

### Connection Pooling

Configure Sequelize connection pool:

```typescript
// src/lib/db/connection.ts
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
  // ... connection config
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
});
```

### Database-Level Optimizations

1. **Analyze Tables**: Regularly run `ANALYZE TABLE` to update statistics
2. **Optimize Tables**: Run `OPTIMIZE TABLE` after large data changes
3. **Monitor Slow Queries**: Enable slow query log in MariaDB

---

## Security Considerations

### SQL Injection Prevention

Sequelize uses parameterized queries by default, preventing SQL injection.

### Password Storage

- Store password hashes (bcrypt), never plain text
- Use strong hashing algorithms (bcrypt with salt rounds ≥ 10)

### Data Access Control

- Enforce RBAC at application layer (not database level)
- Use database views or stored procedures only if needed for complex queries

---

## Future Enhancements

### Potential Schema Additions

1. **User Assignments Table**: Many-to-many relationship for project/study assignments
   ```typescript
   // For tracking which researchers are assigned to which projects/studies
   ProjectUserAssignment
   StudyUserAssignment
   ```

2. **Task Dependencies**: Support task dependencies
   ```typescript
   TaskDependency {
     taskId: number;
     dependsOnTaskId: number;
   }
   ```

3. **Notifications**: User notification preferences and history
   ```typescript
   Notification {
     userId: number;
     type: string;
     message: string;
     readAt: Date | null;
   }
   ```

4. **Tags/Labels**: Flexible tagging system
   ```typescript
   Tag {
     name: string;
   }
   TaskTag {
     taskId: number;
     tagId: number;
   }
   ```

---

**Document Version**: 1.0  
**Last Updated**: Initial creation  
**Maintained By**: Database & ORM Engineer


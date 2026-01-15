// Model exports and associations

import { User } from './user';
import { Project } from './project';
import { Study } from './study';
import { Task } from './task';
import { Message } from './message';
import { ComplianceFlag } from './complianceFlag';
import { TaskRequest } from './taskRequest';
import { TaskAssignment } from './taskAssignment';
import { Notification } from './notification';
import { TaskRead } from './taskRead';
import { ProjectRead } from './projectRead';
import { StudyRead } from './studyRead';

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

User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages',
});

User.hasMany(ComplianceFlag, {
  foreignKey: 'raisedById',
  as: 'raisedFlags',
});

User.hasMany(ComplianceFlag, {
  foreignKey: 'resolvedById',
  as: 'resolvedFlags',
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

Project.hasMany(Task, {
  foreignKey: 'projectId',
  as: 'tasks',
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

Task.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
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

Task.hasMany(ComplianceFlag, {
  foreignKey: 'taskId',
  as: 'complianceFlags',
});

// Task many-to-many assignments
Task.belongsToMany(User, {
  through: TaskAssignment,
  foreignKey: 'taskId',
  otherKey: 'userId',
  as: 'assignedResearchers',
});

User.belongsToMany(Task, {
  through: TaskAssignment,
  foreignKey: 'userId',
  otherKey: 'taskId',
  as: 'assignedTasksMany',
});

TaskAssignment.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task',
});

TaskAssignment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

TaskAssignment.belongsTo(User, {
  foreignKey: 'assignedById',
  as: 'assignedBy',
});

// TaskRequest associations
TaskRequest.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task',
});

TaskRequest.belongsTo(User, {
  foreignKey: 'requestedById',
  as: 'requestedBy',
});

TaskRequest.belongsTo(User, {
  foreignKey: 'requestedAssignedToId',
  as: 'requestedAssignedTo',
});

TaskRequest.belongsTo(User, {
  foreignKey: 'reviewedById',
  as: 'reviewedBy',
});

Task.hasMany(TaskRequest, {
  foreignKey: 'taskId',
  as: 'requests',
});

User.hasMany(TaskRequest, {
  foreignKey: 'requestedById',
  as: 'requestedTasks',
});

// Notification associations
Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Notification.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task',
});

Notification.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
});

Notification.belongsTo(Study, {
  foreignKey: 'studyId',
  as: 'study',
});

Notification.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});

User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications',
});

// TaskRead associations
TaskRead.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task',
});

TaskRead.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Task.belongsToMany(User, {
  through: TaskRead,
  foreignKey: 'taskId',
  otherKey: 'userId',
  as: 'readBy',
});

User.belongsToMany(Task, {
  through: TaskRead,
  foreignKey: 'userId',
  otherKey: 'taskId',
  as: 'readTasks',
});

// Message Associations
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});

Message.belongsTo(Message, {
  foreignKey: 'replyToId',
  as: 'replyTo',
});

Message.hasMany(Message, {
  foreignKey: 'replyToId',
  as: 'replies',
});

// ComplianceFlag Associations
ComplianceFlag.belongsTo(Task, {
  foreignKey: 'taskId',
  as: 'task',
});

ComplianceFlag.belongsTo(User, {
  foreignKey: 'raisedById',
  as: 'raisedBy',
});

ComplianceFlag.belongsTo(User, {
  foreignKey: 'resolvedById',
  as: 'resolvedBy',
});

export { User, Project, Study, Task, Message, ComplianceFlag, TaskRequest, TaskAssignment, Notification, TaskRead, ProjectRead, StudyRead };


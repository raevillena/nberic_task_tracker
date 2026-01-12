// Model exports and associations

import { User } from './user';
import { Project } from './project';
import { Study } from './study';
import { Task } from './task';
import { Message } from './message';
import { ComplianceFlag } from './complianceFlag';

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

Task.hasMany(ComplianceFlag, {
  foreignKey: 'taskId',
  as: 'complianceFlags',
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

export { User, Project, Study, Task, Message, ComplianceFlag };


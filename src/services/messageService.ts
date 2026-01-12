// Message service - business logic for chat messages

import { Message, User } from '@/lib/db/models';
import { MessageRoomType, MessageType } from '@/types/socket';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { canAccessResource } from '@/lib/rbac/guards';
import { UserRole } from '@/types/entities';
import { Op } from 'sequelize';

/**
 * Get messages for a room with pagination
 */
export async function getMessagesByRoom(
  roomType: MessageRoomType,
  roomId: number,
  user: UserContext,
  limit: number = 50,
  cursor?: number
): Promise<{ messages: Message[]; hasMore: boolean; nextCursor?: number }> {
  // Check room access
  const hasAccess = await canAccessResource(
    user.id,
    user.role,
    roomType,
    roomId
  );

  if (!hasAccess) {
    throw new PermissionError(`Access denied to ${roomType} ${roomId}`);
  }

  const whereClause: any = {
    roomType,
    roomId,
    deletedAt: null, // Exclude soft-deleted messages
  };

  if (cursor) {
    whereClause.id = { [Op.lt]: cursor };
  }

  const messages = await Message.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
      },
      {
        model: Message,
        as: 'replyTo',
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: limit + 1, // Fetch one extra to check if there are more
  });

  const hasMore = messages.length > limit;
  const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && messagesToReturn.length > 0
    ? messagesToReturn[messagesToReturn.length - 1].id
    : undefined;

  // Reverse to return in chronological order
  messagesToReturn.reverse();

  return {
    messages: messagesToReturn,
    hasMore,
    nextCursor,
  };
}

/**
 * Create a new message
 */
export async function createMessage(
  roomType: MessageRoomType,
  roomId: number,
  senderId: number,
  content: string,
  type: MessageType = 'text',
  fileId?: number,
  fileName?: string,
  fileSize?: number,
  mimeType?: string,
  replyToId?: number
): Promise<Message> {
  // Validate content
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content cannot be empty');
  }

  if (content.length > 10000) {
    throw new ValidationError('Message content exceeds maximum length of 10,000 characters');
  }

  // Validate replyToId if provided
  if (replyToId) {
    const replyToMessage = await Message.findByPk(replyToId);
    if (!replyToMessage || replyToMessage.roomType !== roomType || replyToMessage.roomId !== roomId) {
      throw new ValidationError('Invalid reply message');
    }
  }

  // Create message
  const message = await Message.create({
    roomType,
    roomId,
    senderId,
    type,
    content: content.trim(),
    fileId: fileId || null,
    fileName: fileName || null,
    fileSize: fileSize || null,
    mimeType: mimeType || null,
    replyToId: replyToId || null,
  });

  // Load message with relations
  const messageWithRelations = await Message.findByPk(message.id, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
      },
      {
        model: Message,
        as: 'replyTo',
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      },
    ],
  });

  if (!messageWithRelations) {
    throw new Error('Failed to load created message');
  }

  return messageWithRelations;
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: number,
  newContent: string,
  user: UserContext
): Promise<Message> {
  // Validate content
  if (!newContent || newContent.trim().length === 0) {
    throw new ValidationError('Message content cannot be empty');
  }

  // Load message
  const message = await Message.findByPk(messageId);

  if (!message) {
    throw new NotFoundError(`Message ${messageId} not found`);
  }

  // Check permissions: sender or manager with room access
  const isSender = message.senderId === user.id;
  const isManager = user.role === UserRole.MANAGER;

  if (!isSender && !isManager) {
    throw new PermissionError('Permission denied to edit this message');
  }

  // If manager, check room access
  if (isManager && !isSender) {
    const hasAccess = await canAccessResource(
      user.id,
      user.role,
      message.roomType,
      message.roomId
    );
    if (!hasAccess) {
      throw new PermissionError('Access denied to edit messages in this room');
    }
  }

  // Check 24-hour edit window
  const hoursSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    throw new ValidationError('Messages cannot be edited after 24 hours');
  }

  // Update message
  await message.update({
    content: newContent.trim(),
    editedAt: new Date(),
  });

  // Load updated message with relations
  const updatedMessage = await Message.findByPk(messageId, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
      },
    ],
  });

  if (!updatedMessage) {
    throw new Error('Failed to load updated message');
  }

  return updatedMessage;
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(
  messageId: number,
  user: UserContext
): Promise<void> {
  // Load message
  const message = await Message.findByPk(messageId);

  if (!message) {
    throw new NotFoundError(`Message ${messageId} not found`);
  }

  // Check permissions: sender or manager with room access
  const isSender = message.senderId === user.id;
  const isManager = user.role === UserRole.MANAGER;

  if (!isSender && !isManager) {
    throw new PermissionError('Permission denied to delete this message');
  }

  // If manager, check room access
  if (isManager && !isSender) {
    const hasAccess = await canAccessResource(
      user.id,
      user.role,
      message.roomType,
      message.roomId
    );
    if (!hasAccess) {
      throw new PermissionError('Access denied to delete messages in this room');
    }
  }

  // Soft delete
  await message.update({
    deletedAt: new Date(),
  });
}


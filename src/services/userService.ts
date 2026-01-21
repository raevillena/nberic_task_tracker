// User service - business logic for users
// NOTE: This app uses external API (umans-api.nbericmmsu.com) as the sole provider of users.
// The local User table is only used as a cache/mapping table for foreign key relationships.
// All user data comes from the external API via syncUserFromExternalApi().

import { User } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { NotFoundError } from '@/lib/utils/errors';

/**
 * Find user by email (case-insensitive)
 * Returns cached user from local database (synced from external API)
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  return User.findOne({
    where: {
      email: email.toLowerCase().trim(),
    },
  });
}

/**
 * Find user by ID
 * Returns cached user from local database (synced from external API)
 */
export async function findUserById(id: number): Promise<User | null> {
  return User.findByPk(id);
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: number): Promise<void> {
  await User.update(
    { lastLoginAt: new Date() },
    { where: { id: userId } }
  );
}

/**
 * Get all researchers (for task assignment)
 * Returns cached researchers from local database (synced from external API)
 * Note: Only researchers who have logged in at least once will appear in this list,
 * as users are synced to local database on first authentication.
 */
export async function getResearchers(): Promise<User[]> {
  return User.findAll({
    where: {
      role: UserRole.RESEARCHER,
      isActive: true,
    },
    attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
  });
}

/**
 * Sync user from external API to local database
 * This is the ONLY way users are created in the local database.
 * The external API (umans-api.nbericmmsu.com) is the sole provider of user data.
 * 
 * The local User table serves as a cache/mapping table for:
 * - Foreign key relationships (task_assignments, notifications, etc.)
 * - Quick lookups without hitting external API on every request
 * 
 * @param data - User data from external API
 * @returns Local database user record (with local database ID for foreign keys)
 */
export async function syncUserFromExternalApi(data: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}): Promise<User> {
  // Find existing user by email (case-insensitive)
  const existingUser = await findUserByEmail(data.email);
  
  if (existingUser) {
    // Update existing cached user with latest info from external API
    await existingUser.update({
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: true, // Ensure user is active
      lastLoginAt: new Date(),
    });
    return existingUser;
  }
  
  // Create new cached user record (users are ONLY created via sync from external API)
  // Use a placeholder password hash since password is required by schema but not used
  // Authentication is handled entirely by external API
  const placeholderPasswordHash = '$2b$10$placeholder.hash.for.external.auth.users';
  
  const newUser = await User.create({
    email: data.email.toLowerCase().trim(),
    passwordHash: placeholderPasswordHash, // Placeholder - not used, auth is external
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    isActive: true,
    tokenVersion: 0, // Not used for external auth, but kept for schema compatibility
    lastLoginAt: new Date(),
  });
  
  return newUser;
}


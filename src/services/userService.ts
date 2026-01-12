// User service - business logic for users

import { User } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { NotFoundError, ValidationError } from '@/lib/utils/errors';

/**
 * Find user by email (case-insensitive)
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
 */
export async function findUserById(id: number): Promise<User | null> {
  return User.findByPk(id);
}

/**
 * Create a new user
 */
export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}): Promise<User> {
  // Check if user already exists
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await User.create({
    email: data.email.toLowerCase().trim(),
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    isActive: true,
    tokenVersion: 0,
  });

  return user;
}

/**
 * Verify user credentials
 */
export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
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


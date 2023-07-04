import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a user in the system.
 */
type User = Record<{
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: nat64;
  resetToken: Opt<string>;
}>

/**
 * Represents the payload for creating a new user.
 */
type UserPayload = Record<{
  username: string;
  email: string;
  password: string;
}>

// Initialize the user storage
const userStorage = new StableBTreeMap<string, User>(0, 44, 1024);

/**
 * Retrieve all users.
 * @returns Result<Vec<User>, string> - The list of users on success, or an error message on failure.
 */
$query
export function getUsers(): Result<Vec<User>, string> {
  return Result.Ok(userStorage.values());
}

/**
 * Get a user by their ID.
 * @param id - The ID of the user to retrieve.
 * @returns Result<User, string> - The user object on success, or an error message on failure.
 */
$query
export function getUser(id: string): Result<User, string> {
  return match(userStorage.get(id), {
    Some: (user) => Result.Ok<User, string>(user),
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

/**
 * Register a new user.
 * @param payload - The user payload containing username, email, and password.
 * @returns Result<User, string> - The created user on success, or an error message on failure.
 */
$update
export function registerUser(payload: UserPayload): Result<User, string> {
  const user: User = {
    id: uuidv4(),
    createdAt: ic.time(),
    resetToken: Opt.None,
    ...payload
  };
  userStorage.insert(user.id, user);
  return Result.Ok(user);
}

/**
 * Login a user.
 * @param username - The username of the user.
 * @param password - The password of the user.
 * @returns Result<User, string> - The authenticated user on success, or an error message on failure.
 */
$query
export function loginUser(username: string, password: string): Result<User, string> {
  const user = userStorage.values().find((u) => u.username === username && u.password === password);
  if (user) {
    return Result.Ok(user);
  }
  return Result.Err<User, string>('Invalid username or password');
}

/**
 * Delete a user.
 * @param id - The ID of the user to delete.
 * @returns Result<User, string> - The deleted user on success, or an error message on failure.
 */
$update
export function deleteUser(id: string): Result<User, string> {
  return match(userStorage.remove(id), {
    Some: (deletedUser) => Result.Ok<User, string>(deletedUser),
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

/**
 * Update user profile information.
 * @param id - The ID of the user to update.
 * @param payload - The updated user payload containing username, email, and password.
 * @returns Result<User, string> - The updated user on success, or an error message on failure.
 */
$update
export function updateUser(id: string, payload: UserPayload): Result<User, string> {
  return match(userStorage.get(id), {
    Some: (user) => {
      const updatedUser: User = {
        ...user,
        username: payload.username || user.username,
        email: payload.email || user.email,
        password: payload.password || user.password
      };
      userStorage.insert(id, updatedUser);
      return Result.Ok<User, string>(updatedUser);
    },
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

/**
 * Change the password of a user.
 * @param id - The ID of the user to update.
 * @param newPassword - The new password for the user.
 * @returns Result<User, string> - The updated user on success, or an error message on failure.
 */
$update
export function changePassword(id: string, newPassword: string): Result<User, string> {
  return match(userStorage.get(id), {
    Some: (user) => {
      const updatedUser: User = {
        ...user,
        password: newPassword
      };
      userStorage.insert(id, updatedUser);
      return Result.Ok<User, string>(updatedUser);
    },
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

/**
 * Request a password reset for a user.
 * @param email - The email of the user requesting the password reset.
 * @returns Result<string, string> - The reset token on success, or an error message on failure.
 */
$update
export function requestPasswordReset(email: string): Result<string, string> {
  const user = userStorage.values().find((u) => u.email === email);
  if (user) {
    const resetToken = generateResetToken();
    userStorage.insert(user.id, { ...user, resetToken: Opt.Some(resetToken) });
    return Result.Ok(resetToken);
  }
  return Result.Err<string, string>('User with the specified email not found');
}

/**
 * Reset the password of a user using a reset token.
 * @param resetToken - The reset token for password reset.
 * @param newPassword - The new password for the user.
 * @returns Result<User, string> - The updated user on success, or an error message on failure.
 */
$update
export function resetPassword(resetToken: string, newPassword: string): Result<User, string> {
  const user = userStorage.values().find((u) => match(u.resetToken, {
    Some: (value: string) => value === resetToken,
    None: () => false
  }));

  if (user) {
    const updatedUser = { ...user, password: newPassword, resetToken: Opt.None };
    userStorage.insert(user.id, updatedUser);
    return Result.Ok(updatedUser);
  }
  return Result.Err<User, string>('Invalid or expired reset token');
}

/**
 * Generate a random reset token.
 * @returns string - The generated reset token.
 */
function generateResetToken(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  }
}

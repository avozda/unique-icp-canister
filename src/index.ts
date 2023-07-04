import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
import { v4 as uuidv4 } from 'uuid';


type User = Record<{
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: nat64;
  resetToken: Opt<string>;
}>

type UserPayload = Record<{
  username: string;
  email: string;
  password: string;
}>

const userStorage = new StableBTreeMap<string, User>(0, 44, 1024);

$query;
export function getUsers(): Result<Vec<User>, string> {
  return Result.Ok(userStorage.values());
}

$query;
export function getUser(id: string): Result<User, string> {
  return match(userStorage.get(id), {
    Some: (user) => Result.Ok<User, string>(user),
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

$update;
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

$query;
export function loginUser(username: string, password: string): Result<User, string> {
  const user = userStorage.values().find((u) => u.username === username && u.password === password);
  if (user) {
    return Result.Ok(user);
  }
  return Result.Err<User, string>('Invalid username or password');
}

$update;
export function deleteUser(id: string): Result<User, string> {
  return match(userStorage.remove(id), {
    Some: (deletedUser) => Result.Ok<User, string>(deletedUser),
    None: () => Result.Err<User, string>(`User with id=${id} not found`)
  });
}

$update;
export function requestPasswordReset(email: string): Result<string, string> {
  const user = userStorage.values().find((u) => u.email === email);
  if (user) {
    const resetToken = generateResetToken();
    userStorage.insert(user.id, { ...user, resetToken: Opt.Some(resetToken) });
    return Result.Ok(resetToken);
  }
  return Result.Err<string, string>('User with the specified email not found');
}

$update;
export function resetPassword(resetToken: string, newPassword: string): Result<User, string> {
  const user = userStorage.values().find((u) => match(u.resetToken, {
    Some: (value:string) => value === resetToken,
    None: () => false
  }));


  if (user) {
    const updatedUser = { ...user, password: newPassword, resetToken: Opt.None };
    userStorage.insert(user.id, updatedUser);
    return Result.Ok(updatedUser);
  }
  return Result.Err<User, string>('Invalid or expired reset token');
}

// Helper function to generate a random reset token
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
        let array = new Uint8Array(32)

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256)
        }

        return array
    }
}
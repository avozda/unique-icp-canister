import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
} from "azle";

type User = Record<{
  id: Principal;
  username: string;
  createdAt: nat64;
  loggedIn: boolean;
  loggedInDuration: Opt<nat64>;
}>;

type UserPayload = Record<{
  username: string;
}>;

const userStorage = new StableBTreeMap<Principal, User>(0, 63, 1024);

// loggedInTime set to 30 seconds
const loggedInTimer: nat64 = BigInt(1000000000 * 30);

/**
 * returns All registered Users
 */
$query;
export function getUsers(): Result<Vec<User>, string> {
  return Result.Ok(userStorage.values());
}
/**
 * returns A registered User or an error message
 */
$query;
export function getUser(id: Principal): Result<User, string> {
  return match(userStorage.get(id), {
    Some: (user) => Result.Ok<User, string>(user),
    None: () => Result.Err<User, string>(`User with id=${id} not found`),
  });
}

/**
 * Registers the caller as a user of the platform
 * Returns an error message if the caller is already registered
 */
$update;
export function registerUser(payload: UserPayload): Result<User, string> {
  // returns an error message if caller is already registered
  if (getUser(ic.caller()).Ok) {
    return Result.Err<User, string>("You are already registered");
  }
  const user: User = {
    id: ic.caller(),
    createdAt: ic.time(),
    loggedIn: false,
    loggedInDuration: Opt.None,
    ...payload,
  };
  userStorage.insert(ic.caller(), user);
  return Result.Ok(user);
}

/**
 * Allows a registered user to login
 * 
 */
$update;
export function loginUser(): Result<User, string> {
  const user = getUser(ic.caller());
  // login only if the caller is registered
  if (user.Ok) {
    const updatedUser: User = {
      ...user.Ok,
      loggedIn: true,
      loggedInDuration: Opt.Some(ic.time() + loggedInTimer),
    };
    userStorage.insert(ic.caller(), updatedUser);
    return Result.Ok<User, string>(updatedUser);
  }
  // return an error message if caller isn't registered
  return Result.Err<User, string>("Caller isn't registered");
}

/**
 * Allows a registered user to delete their profile
 */
$update;
export function deleteUser(): Result<User, string> {
  return match(userStorage.remove(ic.caller()), {
    Some: (deletedUser) => Result.Ok<User, string>(deletedUser),
    None: () =>
      Result.Err<User, string>(`User with id=${ic.caller()} not found`),
  });
}

/**
 * Allows a logged in user to logout
 */
$update;
export function logoutUser(): Result<User, string> {
  const user = getUser(ic.caller());
  // logout only if the caller is registered
  if (user.Ok) {
    if(!user.Ok.loggedIn){
      return Result.Err<User, string>(`Caller isn't logged in`);
    }
    const updatedUser: User = {
      ...user.Ok,
      loggedIn: false,
      loggedInDuration: Opt.None,
    };
    userStorage.insert(ic.caller(), updatedUser);
    return Result.Ok<User, string>(updatedUser);
  }
  // return an error message if caller isn't registered
  return Result.Err<User, string>("Caller isn't registered");
}

import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64,Principal, ic, Opt, $init } from 'azle';
import { v4 as uuidv4 } from 'uuid';

//Record to describe the details about the user
type User = Record<{
  username: string;
  email: string;
  secret: string;
  createdAt: nat64;
}>

type UserPayload = Record<{
  username: string;
  email: string;
  secret: string
}>
//variable to store the Principal ID of the canister admin
let adminPrincipal : Principal;

//map to store the users in the canister
const userStorage = new StableBTreeMap<Principal, User>(0, 44, 1024);


//initlalize the admin on deployment
$init;
export function init(admin : string) : void{
  adminPrincipal = Principal.fromText(admin)
}



//return all registered users from the canister
$query;
export function getUsers(): Result<Vec<User>, string> {
  return Result.Ok(userStorage.values());
}


//get the details of the user associated with a specific Principal ID
$query;
export function getUser(id: string): Result<User, string> {
  const user = Principal.fromText(id);
  return match(userStorage.get((user)), {
    Some: (user) => Result.Ok<User, string>(user),
    None: () => Result.Err<User, string>(`User dont have an account registered yet`)
  });
}


//Register the user to the canister
$update;
export function registerUser(payload: UserPayload): Result<User, string> {
  const caller = ic.caller();
  if(caller.toString() === "2vxsx-fae"){
    return Result.Err<User,string>("Anonymous users are not allowed to register accounts")
  }
  const user: User = {
    createdAt: ic.time(),
    ...payload
  };
  userStorage.insert(caller, user);
  return Result.Ok(user);
}


// let the user login using their Principal ID
$query;
export function loginUser(): Result<User, string> {
  const caller = ic.caller();
  return match(userStorage.get(caller),{
    None : ()=>{ return Result.Err<User,string>("You dont have an account yet")},
    Some : (user)=>{ return Result.Ok<User,string>(user)}
  });
}


//Only admin is allowed to delete an account
$update;
export function deleteUser(id: string): Result<User, string> {
  const caller = ic.caller();
  if(caller === adminPrincipal){

    return match(userStorage.remove(Principal.fromText(id)), {
      Some: (deletedUser) => Result.Ok<User, string>(deletedUser),
      None: () => Result.Err<User, string>(`User with Principal Id=${id} not found`)
    });
  }
  return Result.Err<User,string>("You are not authorized")
}


//reclaim an old account by providing the secret associated with it
$update;
export function reclaimAccount( account : string, secret : string): Result<string,string>{
  const caller = ic.caller();
  return match(userStorage.get(Principal.fromText(account)),{

    None : ()=>{ return Result.Err<string,string>("This account does not exist")},
    Some : (oldAccount)=>{
      if(oldAccount.secret === secret){
        userStorage.insert(caller, oldAccount);
        return Result.Ok<string,string>("Your account details have been restored, you can now login with the current Principal ID")
      }
      return Result.Err<string,string>("The secrets dont match, try again later")
     }
  });
}

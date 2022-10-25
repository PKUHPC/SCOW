import { AccountInfo, GetClusterUsersReply, UserInAccount, UserInfo } from "src/generated/server/admin";

export function parseClusterUsers(dataStr: string): GetClusterUsersReply {
  const obj: GetClusterUsersReply = {
    accounts:[] as AccountInfo[],
    users:[] as UserInfo[],
  };

  if (dataStr.trim() === "") { return obj; }

  const lines = dataStr.split("\n");

  let i = 0;
  while (i < lines.length) {
    const account = lines[i].trim();
    const accountIndex = obj.accounts.push({ accountName: account, users: [] as UserInAccount[] });
    i++;
    while (lines[i].trim() != "") {
      const [user, status] = lines[i].split(":").map((x) => x.trim());
      const userIndex = obj.users.findIndex((x) => x.userId === user);
      if (userIndex == -1) {
        obj.users.push({ userId: user, userName: user, accounts: [account]});
      }
      else {
        obj.users[userIndex].accounts.push(account);
      }
      if (account == "a_" + user) {
        if (obj.accounts[accountIndex - 1].owner === undefined) {
          obj.accounts[accountIndex - 1].owner = user;
        } 
      }
      obj.accounts[accountIndex - 1].users.push({ userId:user, state:status });
      i++;
    }
    i++;
  }

  return obj;
}
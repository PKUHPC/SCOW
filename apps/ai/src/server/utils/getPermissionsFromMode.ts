import { TRPCError } from "@trpc/server";

type Role = "user" | "group" | "other";

interface PermissionResult {
  canRead: boolean;
  canWrite: boolean;
  canExec: boolean;
}

export function getPermissionsFromMode(mode: number, role: Role = "user"): PermissionResult {
  const PERMISSIONS = {
    read: { user: 0o400, group: 0o040, other: 0o004 },
    write: { user: 0o200, group: 0o020, other: 0o002 },
    exec: { user: 0o100, group: 0o010, other: 0o001 },
  };

  if (!["user", "group", "other"].includes(role)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid role: '${role}'. Must be 'user', 'group', or 'other'.`,
    });
  }

  return {
    canRead: (mode & PERMISSIONS.read[role]) !== 0,
    canWrite: (mode & PERMISSIONS.write[role]) !== 0,
    canExec: (mode & PERMISSIONS.exec[role]) !== 0,
  };
}

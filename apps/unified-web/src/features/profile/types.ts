export type ProfileErrorCode =
  | "OLD_PASSWORD_INCORRECT"
  | "PASSWORD_NOT_VALID"
  | "UNAVAILABLE"
  | "USER_NOT_FOUND"
  | "UNKNOWN";

export class ProfileApiError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(code);
  }
}

export interface LocalizedConfigText {
  i18n: {
    default: string;
    en?: string;
    zh_cn?: string;
    ja?: string;
    ko?: string;
    fr?: string;
    de?: string;
    es?: string;
    pt?: string;
    ru?: string;
  };
}

export interface ProfileUser {
  identityId: string;
  name?: string;
  tenantRoles?: number[];
  platformRoles?: number[];
  email?: string;
  phone?: string;
  organization?: string;
  createTime?: string;
}

export interface ProfileData {
  user?: ProfileUser;
  enableChangePassword: boolean;
  passwordPattern?: string;
  passwordPatternMessage?: string | LocalizedConfigText;
}

export interface ProfileApi {
  getProfileData(): Promise<ProfileData>;
  changeEmail(newEmail: string): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

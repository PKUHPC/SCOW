import { Collection, Entity, Enum, ManyToOne, OneToMany, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Tenant } from "src/entities/Tenant";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { UserAccount } from "src/entities/UserAccount";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";
import { type AnyJson } from "src/utils/types";

export enum PlatformRole {
  PLATFORM_FINANCE = "PLATFORM_FINANCE",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
}

export enum TenantRole {
  TENANT_FINANCE = "TENANT_FINANCE",
  TENANT_ADMIN = "TENANT_ADMIN",
}

export enum UserState {
  NORMAL = "NORMAL",
  DELETED = "DELETED",
}

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { ref: true })
  tenant: Ref<Tenant>;

  @Property({ unique: true })
  userId: string;

  @OneToMany(() => TenantUserStorageQuota, (quota) => quota.user)
  storageQuotas = new Collection<TenantUserStorageQuota>(this);

  @Property()
  name: string;

  @Property()
  email: string;

  @Property({ type: "varchar", length: 20, nullable: true })
  phone?: string;

  @Property({ type: "text", nullable: true })
  adminComment?: string;

  @Property({ type: "text", nullable: true })
  organization?: string;

  @Property({ type: "json", nullable: true })
  metadata?: AnyJson;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  createTime: Date;

  @OneToMany(() => UserAccount, (u) => u.user)
  accounts = new Collection<UserAccount>(this);

  @Enum({ items: () => TenantRole, array: true, comment: Object.values(TenantRole).join(", ") })
  tenantRoles: TenantRole[];

  @Enum({ items: () => PlatformRole, array: true, comment: Object.values(PlatformRole).join(", ") })
  platformRoles: PlatformRole[];

  @Enum({ items: () => UserState, default: UserState.NORMAL, comment: Object.values(UserState).join(", ") })
  state: UserState = UserState.NORMAL;

  @Property({ nullable: true })
  deletionComment?: string;

  constructor(init: {
    userId: string;
    tenant: EntityOrRef<Tenant>;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    adminComment?: string;
    createTime?: Date;
    tenantRoles?: TenantRole[];
    platformRoles?: PlatformRole[];
    state?: UserState;
    deletionComment?: string;
    metadata?: AnyJson;
  }) {
    this.userId = init.userId;
    this.tenant = toRef(init.tenant);
    this.name = init.name;
    this.email = init.email;
    this.phone = init.phone;
    this.organization = init.organization;
    this.adminComment = init.adminComment;
    this.metadata = init.metadata;
    this.createTime = init.createTime ?? new Date();
    this.tenantRoles = init.tenantRoles ?? [];
    this.platformRoles = init.platformRoles ?? [];
    this.state = init.state ?? UserState.NORMAL;
    this.deletionComment = init.deletionComment ?? "";
  }
}

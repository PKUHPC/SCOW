import { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { requireAuth } from "src/auth/requireAuth";
import { TenantRole } from "src/models/User";

export const StorageManagerIndexPage: NextPage =
  requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {
    const router = useRouter();

    useEffect(() => {
      void router.replace("/tenant/storageManager/userBaseStorageQuota");
    }, [router]);

    return null;
  });

export default StorageManagerIndexPage;

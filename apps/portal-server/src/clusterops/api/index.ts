import { AppOps } from "src/clusterops/api/app";
import { DesktopOps } from "src/clusterops/api/desktop";
import { FileOps } from "src/clusterops/api/file";
import { JobOps } from "src/clusterops/api/job";
import { ShellOps } from "src/clusterops/api/shell";

export interface ClusterOps {
  app: AppOps;
  job: JobOps;
  desktop: DesktopOps;
  file: FileOps;
  shell: ShellOps;
}

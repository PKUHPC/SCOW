export interface Cluster {
  id: string;
  name: string;
  description?: string;
}

export interface LoginDesktopCluster extends Cluster {
  shadowdeskEnabled?: boolean;
  hasShadowdeskConfig?: boolean;
  shadowdeskAvailableWms?: string[];
}

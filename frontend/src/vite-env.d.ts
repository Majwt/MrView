interface GitInfo {
  branch: string;
  commit: string;
  commitLong: string;
  commitDate: string;
  tag: string;
  buildDate: string;
  dirty: boolean;
}

interface ImportMetaEnv {
  readonly VITE_GIT_INFO: GitInfo;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

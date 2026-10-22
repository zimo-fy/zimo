import { access, mkdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface AppDataLayout {
  root: string;
  system: {
    root: string;
    secrets: string;
    logs: string;
    recovery: string;
  };
  accounts: {
    root: string;
    local: string;
    database: string;
    knowledge: string;
    skills: string;
    browserProfiles: string;
  };
  workspaces: string;
}

export async function prepareAppDataLayout(userDataPath: string): Promise<AppDataLayout> {
  const root = resolve(userDataPath);
  const systemRoot = join(root, "system");
  const accountsRoot = join(root, "accounts");
  const localAccountRoot = join(accountsRoot, "local");
  const workspaces = join(root, "workspaces");
  const layout: AppDataLayout = {
    root,
    system: {
      root: systemRoot,
      secrets: join(systemRoot, "secrets.enc"),
      logs: join(systemRoot, "logs"),
      recovery: join(systemRoot, "workspace-recovery"),
    },
    accounts: {
      root: accountsRoot,
      local: localAccountRoot,
      database: join(localAccountRoot, "zimo.sqlite"),
      knowledge: join(localAccountRoot, "knowledge-files"),
      skills: join(localAccountRoot, "skill-runtime"),
      browserProfiles: join(localAccountRoot, "browser-profiles"),
    },
    workspaces,
  };

  await migrateLegacyPath(join(root, "zimo.sqlite-wal"), `${layout.accounts.database}-wal`);
  await migrateLegacyPath(join(root, "zimo.sqlite-shm"), `${layout.accounts.database}-shm`);
  await migrateLegacyPath(join(root, "zimo.sqlite"), layout.accounts.database);
  await migrateLegacyPath(join(root, "secrets.enc"), layout.system.secrets);
  await migrateLegacyPath(join(root, "knowledge-files"), layout.accounts.knowledge);
  await migrateLegacyPath(join(root, "skill-runtime"), layout.accounts.skills);
  await migrateLegacyPath(join(root, "document-workspaces"), layout.workspaces);
  await migrateLegacyPath(join(root, "workspace-recovery"), layout.system.recovery);
  await Promise.all([
    mkdir(layout.system.root, { recursive: true, mode: 0o700 }),
    mkdir(layout.system.logs, { recursive: true, mode: 0o700 }),
    mkdir(layout.system.recovery, { recursive: true, mode: 0o700 }),
    mkdir(layout.accounts.knowledge, { recursive: true, mode: 0o700 }),
    mkdir(layout.accounts.skills, { recursive: true, mode: 0o700 }),
    mkdir(layout.accounts.browserProfiles, { recursive: true, mode: 0o700 }),
    mkdir(layout.workspaces, { recursive: true, mode: 0o700 }),
  ]);
  return layout;
}

async function migrateLegacyPath(source: string, destination: string): Promise<void> {
  if (!(await exists(source)) || (await exists(destination))) return;
  await mkdir(resolve(destination, ".."), { recursive: true, mode: 0o700 });
  await rename(source, destination);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

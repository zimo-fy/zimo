export type UserMemoryKind = "preference" | "goal" | "open_issue";

export interface UserMemory {
  id: string;
  ownerUserId: string;
  kind: UserMemoryKind;
  content: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMemoryRepository {
  list(ownerUserId: string): Promise<readonly UserMemory[]>;
  get(ownerUserId: string, id: string): Promise<UserMemory | null>;
  create(value: UserMemory): Promise<void>;
  update(
    ownerUserId: string,
    id: string,
    value: Pick<UserMemory, "kind" | "content" | "enabled" | "updatedAt">,
  ): Promise<boolean>;
  delete(ownerUserId: string, id: string): Promise<boolean>;
}

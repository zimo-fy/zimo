import type { AuthSession, Clock, IdGenerator, SessionStore } from "@zimo/domain";

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(value: Date): void {
    this.current = new Date(value);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private index = 0;

  create(): string {
    this.index += 1;
    return `00000000-0000-4000-8000-${this.index.toString().padStart(12, "0")}`;
  }
}

export class MemorySessionStore implements SessionStore {
  private session: AuthSession | null = null;

  async get(): Promise<AuthSession | null> {
    return this.session;
  }

  async save(session: AuthSession): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

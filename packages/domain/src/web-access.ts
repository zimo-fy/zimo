import type { ModelConnection } from "./index";

export type WebSearchProviderKind = "brave" | "tavily" | "searxng" | "model_native";
export type ExternalWebSearchProviderKind = Exclude<WebSearchProviderKind, "model_native">;

export interface WebSearchConfiguration {
  ownerUserId: string;
  provider: WebSearchProviderKind;
  baseUrl?: string | undefined;
  secretRef?: string | undefined;
  updatedAt: Date;
}

export interface WebSearchConfigurationRepository {
  get(ownerUserId: string): Promise<WebSearchConfiguration | null>;
  save(configuration: WebSearchConfiguration): Promise<void>;
  delete(ownerUserId: string): Promise<void>;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string | undefined;
}

export interface WebSearchGateway {
  search(
    input: Readonly<{
      provider: ExternalWebSearchProviderKind;
      apiKey?: string | undefined;
      baseUrl?: string | undefined;
      query: string;
      count: number;
      freshness?: "day" | "week" | "month" | undefined;
    }>,
    signal: AbortSignal,
  ): Promise<readonly WebSearchResult[]>;

  fetch(
    input: Readonly<{
      url: string;
      maxCharacters: number;
    }>,
    signal: AbortSignal,
  ): Promise<Readonly<{ url: string; title?: string | undefined; content: string }>>;
}

export interface ModelNativeSearchGateway {
  search(
    connection: ModelConnection,
    input: Readonly<{ query: string; count: number }>,
    signal: AbortSignal,
  ): Promise<Readonly<{ results: readonly WebSearchResult[]; errorCount: number }>>;
}

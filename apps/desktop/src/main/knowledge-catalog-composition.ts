import { KnowledgeDirectoryCatalogService } from "@zimo/application";
import type { SecretStore, SessionStore } from "@zimo/domain";
import { ZimoKnowledgeDirectoryCatalogGateway } from "@zimo/knowledge-catalog-zimo";

export function createKnowledgeDirectoryCatalogService(options: {
  authBaseUrl: string;
  sessions: SessionStore;
  secrets: SecretStore;
}): KnowledgeDirectoryCatalogService {
  return new KnowledgeDirectoryCatalogService(
    new ZimoKnowledgeDirectoryCatalogGateway(options.authBaseUrl, options.sessions, options.secrets),
  );
}

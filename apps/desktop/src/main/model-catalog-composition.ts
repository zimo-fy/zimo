import { ModelCatalogService } from "@zimo/application";
import type { SecretStore, SessionStore } from "@zimo/domain";
import { ZimoModelCatalogGateway } from "@zimo/model-catalog-zimo";

export function createModelCatalogService(options: {
  authBaseUrl: string;
  sessions: SessionStore;
  secrets: SecretStore;
}): ModelCatalogService {
  return new ModelCatalogService(
    new ZimoModelCatalogGateway(options.authBaseUrl, options.sessions, options.secrets),
  );
}

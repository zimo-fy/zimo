import { LocalAgentCatalogGateway } from "@zimo/agent-zimo";
import { AgentMarketplaceService } from "@zimo/application";
import type { AgentRepository, Clock, IdGenerator } from "@zimo/domain";

export function createAgentMarketplaceService(options: {
  agents: AgentRepository;
  clock: Clock;
  ids: IdGenerator;
  agentsDirectory: string;
}): AgentMarketplaceService {
  return new AgentMarketplaceService(
    new LocalAgentCatalogGateway(options.agentsDirectory),
    options.agents,
    options.clock,
    options.ids,
  );
}

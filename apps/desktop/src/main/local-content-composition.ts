import { DocumentArtifactService, KnowledgeService } from "@zimo/application";
import type {
  Clock,
  ConversationRepository,
  DocumentArtifactRepository,
  EmbeddingProvider,
  IdGenerator,
  KnowledgeRepository,
} from "@zimo/domain";
import { BundledBgeEmbeddingProvider, LocalKnowledgeFileImporter } from "@zimo/knowledge-local";
import { LocalDocumentFileStore } from "@zimo/knowledge-local/document-file-store";
import { LocalDocumentContentAdapter } from "@zimo/knowledge-local/document-content-adapter";

import { renderDocumentPdf } from "./chromium-pdf-renderer";

export async function createLocalContentServices(options: {
  knowledgeRepository: KnowledgeRepository;
  documentRepository: DocumentArtifactRepository;
  conversationRepository: ConversationRepository;
  knowledgeStorageRoot: string;
  documentStorageRoot: string;
  embeddingModelPath: string;
  disableEmbeddings: boolean;
  clock: Clock;
  ids: IdGenerator;
}) {
  const embeddings = options.disableEmbeddings
    ? disabledEmbeddingProvider()
    : new BundledBgeEmbeddingProvider(options.embeddingModelPath);
  const knowledge = new KnowledgeService(
    options.knowledgeRepository,
    new LocalKnowledgeFileImporter(),
    embeddings,
    options.knowledgeStorageRoot,
    options.clock,
    options.ids,
  );
  await knowledge.prepareEmbeddingIndex().catch(() => undefined);
  return {
    knowledge,
    documents: new DocumentArtifactService(
      options.documentRepository,
      new LocalDocumentFileStore(options.documentStorageRoot),
      options.conversationRepository,
      new LocalDocumentContentAdapter(renderDocumentPdf),
      options.clock,
      options.ids,
    ),
  };
}

function disabledEmbeddingProvider(): EmbeddingProvider {
  return {
    getStatus: async () => ({
      key: "disabled-for-test",
      displayName: "本地语义检索（测试中禁用）",
      revision: "test",
      dimensions: 0,
      status: "failed",
      localOnly: true,
      errorCode: "EMBEDDING_DISABLED_FOR_TEST",
    }),
    embed: async () => [],
  };
}

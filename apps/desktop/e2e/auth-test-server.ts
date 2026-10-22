import { createServer, type Server } from "node:http";

import type { Page } from "@playwright/test";

export interface AuthTestServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

export async function startAuthTestServer(): Promise<AuthTestServer> {
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      response.setHeader("Content-Type", "application/json");
      if (request.url?.includes("/ai/knowledge/directory/tree-with-documents")) {
        const valid = request.headers.authorization === "Bearer e2e-auth-token";
        response.end(
          JSON.stringify(
            valid
              ? {
                  code: 200,
                  msg: "操作成功",
                  success: true,
                  data: {
                    tree: [
                      {
                        id: 3,
                        name: "部门测试",
                        documentCount: 1,
                        totalDocumentCount: 1,
                        documents: [
                          {
                            id: 4,
                            name: "折后价问题汇总",
                            originalFilename: "折后价问题汇总.docx",
                            fileExt: "docx",
                            fileSize: 225553,
                            status: "normal",
                            checksum: "e2e-checksum",
                            storagePath: "https://files.example.com/e2e-knowledge.docx",
                          },
                        ],
                        children: [],
                      },
                    ],
                    uncategorizedDocuments: [],
                  },
                }
              : { success: false, code: 401 },
          ),
        );
        return;
      }
      if (request.url?.startsWith("/dev-api/label/management/list")) {
        response.end(
          JSON.stringify({
            success: true,
            code: 200,
            rows: [{ id: 9, labelName: "人力资源" }],
          }),
        );
        return;
      }
      if (request.url?.startsWith("/dev-api/ai/agents_management/list")) {
        response.end(
          JSON.stringify({
            success: true,
            code: 200,
            rows: [
              {
                id: 17,
                agentName: "云端招聘专家",
                remark: "筛选和整理候选人资料",
                agentLabelId: 9,
                icon: "招",
                modelApiKey: "secret-e2e-agent-canary",
              },
            ],
          }),
        );
        return;
      }
      if (request.url === "/dev-api/system/agents/add_agents" && request.method === "POST") {
        const valid = request.headers.authorization === "Bearer e2e-auth-token";
        const input = JSON.parse(body) as Record<string, unknown>;
        response.end(
          JSON.stringify(
            valid && input.cloudAgentId === "17" && input.creatorId === "e2e-user-1"
              ? {
                  success: true,
                  code: 200,
                  data: {
                    id: "remote-agent-17",
                    modelApiKey: "secret-e2e-agent-canary",
                  },
                }
              : { success: false, code: 400 },
          ),
        );
        return;
      }
      if (request.url?.startsWith("/dev-api/system/agents/list") && request.method === "GET") {
        response.end(JSON.stringify({ success: true, code: 200, rows: [] }));
        return;
      }
      if (
        request.url === "/dev-api/system/agents/delAgents/remote-agent-17" &&
        request.method === "DELETE"
      ) {
        response.end(
          JSON.stringify({
            success: request.headers.authorization === "Bearer e2e-auth-token",
            code: 200,
          }),
        );
        return;
      }
      if (request.url === "/dev-api/zimoLogin") {
        const form = new URLSearchParams(body);
        const valid =
          form.get("username") === "staff-01" && form.get("password") === "test-password";
        response.end(
          JSON.stringify(
            valid
              ? {
                  success: true,
                  code: 200,
                  token: "e2e-auth-token",
                  modelApiKey: "sk-phase-two-e2e-canary",
                  userId: "e2e-user-1",
                  phonenumber: "staff-01",
                  nickName: "Zimo 用户",
                }
              : { success: false, code: 401, msg: "账号或密码不正确" },
          ),
        );
        return;
      }
      const valid = request.headers.authorization === "Bearer e2e-auth-token";
      response.end(
        JSON.stringify(
          valid
            ? { success: true, code: 200, data: { userId: "e2e-user-1" } }
            : { success: false, code: 401 },
        ),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("auth test server unavailable");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/dev-api/`,
    close: () => closeServer(server),
  };
}

export async function loginTestUser(
  page: Page,
  model: { name: string; baseUrl: string } = {
    name: "deepseek-flash",
    baseUrl: "https://example.com/v1",
  },
): Promise<void> {
  const { completeModelOnboarding } = await import("./onboarding");
  await completeModelOnboarding(page, model);
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

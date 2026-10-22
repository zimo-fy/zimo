import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { ZimoHttpAuthGateway } from "./index";

describe("ZimoHttpAuthGateway", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    server = undefined;
  });

  it("uses the xclaw form login and bearer verification protocol", async () => {
    const requests: Array<{ path: string; authorization?: string; body: string }> = [];
    server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        requests.push({
          path: request.url ?? "",
          ...(request.headers.authorization
            ? { authorization: request.headers.authorization }
            : {}),
          body,
        });
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/dev-api/zimoLogin") {
          response.end(
            JSON.stringify({
              success: true,
              code: 200,
              token: "signed-token",
              modelApiKey: "model-key-canary",
              userId: 42,
              phonenumber: "13800138000",
              email: "USER@EXAMPLE.COM",
              nickName: "招聘经理",
            }),
          );
          return;
        }
        response.end(JSON.stringify({ success: true, code: 200, data: { userId: 42 } }));
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server unavailable");
    const gateway = new ZimoHttpAuthGateway(`http://127.0.0.1:${address.port}/dev-api/`);

    const login = await gateway.login({ username: "staff 01", password: "p&ss=word" });
    const verified = await gateway.verify(login.token);

    expect(login).toMatchObject({
      token: "signed-token",
      modelApiKey: "model-key-canary",
      externalUserId: "42",
      account: "13800138000",
      email: "user@example.com",
      displayName: "招聘经理",
    });
    expect(verified).toEqual({ valid: true, externalUserId: "42" });
    expect(requests).toEqual([
      { path: "/dev-api/zimoLogin", body: "username=staff+01&password=p%26ss%3Dword" },
      { path: "/dev-api/verify-token", authorization: "Bearer signed-token", body: "" },
    ]);
  });

  it("rejects a successful login response without a model API key", async () => {
    server = createServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ success: true, code: 200, token: "signed-token", userId: 42 }));
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server unavailable");
    const gateway = new ZimoHttpAuthGateway(`http://127.0.0.1:${address.port}/dev-api/`);

    await expect(
      gateway.login({ username: "staff-01", password: "password" }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_RESPONSE" });
  });
});

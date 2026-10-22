import type { ZimoAuthGateway, ZimoLoginResult } from "@zimo/auth-zimo";
import type { LoginInput } from "@zimo/domain";
import { AppError } from "@zimo/domain";

export class UnconfiguredRemoteAuthGateway implements ZimoAuthGateway {
  login(_input: LoginInput): Promise<ZimoLoginResult> {
    return Promise.reject(
      new AppError({
        code: "AUTH_REMOTE_UNCONFIGURED",
        category: "configuration",
        userMessage: "远程认证服务未配置。请使用「开始使用 Zimo」完成引导，或联系管理员。",
      }),
    );
  }

  verify(_token: string): Promise<{ valid: boolean }> {
    return Promise.resolve({ valid: false });
  }
}

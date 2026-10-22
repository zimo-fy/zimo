import process from "node:process";

const [expectedPlatform, expectedArchitecture] = process.argv.slice(2);

if (!expectedPlatform) {
  throw new Error("缺少目标操作系统参数，无法校验 Bytenode 构建环境。");
}

if (process.platform !== expectedPlatform) {
  throw new Error(
    `Bytenode 字节码必须在目标操作系统构建：当前 ${process.platform}，目标 ${expectedPlatform}。`,
  );
}

if (expectedArchitecture && process.arch !== expectedArchitecture) {
  throw new Error(
    `Bytenode 字节码必须在目标架构构建：当前 ${process.arch}，目标 ${expectedArchitecture}。`,
  );
}

process.stdout.write(`Bytenode 构建主机校验通过：${process.platform}-${process.arch}\n`);

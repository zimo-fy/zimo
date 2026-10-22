"use strict";
/* eslint-disable @typescript-eslint/no-require-imports, no-undef -- Electron must load this build-only compiler as an early CommonJS Main entry. */

const { readFileSync, writeFileSync } = require("node:fs");
const Module = require("node:module");

const jobFile = process.env.ZIMO_BYTENODE_JOB_FILE;
const bytenodeModule = process.env.ZIMO_BYTENODE_MODULE;

if (!jobFile) {
  throw new Error("缺少受控 Bytenode 编译任务配置。");
}

const bytenode = bytenodeModule ? require(bytenodeModule) : require("bytenode");
const jobs = JSON.parse(readFileSync(jobFile, "utf8"));

if (!Array.isArray(jobs) || jobs.length === 0) {
  throw new Error("Bytenode 编译任务为空。");
}

for (const job of jobs) {
  if (!job || typeof job.source !== "string" || typeof job.output !== "string") {
    throw new Error("Bytenode 编译任务格式无效。");
  }
  const source = readFileSync(job.source, "utf8");
  const bytecode = bytenode.compileCode(Module.wrap(source), true);
  writeFileSync(job.output, bytecode, { mode: 0o644 });
}

process.exit(0);

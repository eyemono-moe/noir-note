import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vite-plus/test";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const fixtureRoot = join(repoRoot, ".tmp-lint-fixtures");

async function lintFixture(source: string) {
  await mkdir(fixtureRoot, { recursive: true });
  const fixtureDir = await mkdtemp(join(fixtureRoot, "case-"));
  const fixturePath = join(fixtureDir, "fixture.tsx");
  await writeFile(fixturePath, source, "utf8");

  try {
    await execFileAsync("vp", ["lint", relative(repoRoot, fixturePath)], {
      cwd: repoRoot,
      timeout: 30_000,
    });
    return { exitCode: 0, output: "" };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: err.code ?? 1,
      output: `${err.stdout ?? ""}${err.stderr ?? ""}`,
    };
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

describe("noir-note/require-create-effect-comment", () => {
  test("reports Solid createEffect calls without an adjacent intent comment", async () => {
    const result = await lintFixture(`
      import { createEffect } from "solid-js";

      createEffect(() => {
        document.title = "note";
      });
    `);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("createEffect requires an adjacent intent comment");
  });

  test("allows Solid createEffect calls with an adjacent intent comment", async () => {
    const result = await lintFixture(`
      import { createEffect } from "solid-js";

      // Sync the document title with the active memo.
      createEffect(() => {
        document.title = "note";
      });
    `);

    expect(result.exitCode).toBe(0);
  });

  test("tracks aliased Solid createEffect imports", async () => {
    const result = await lintFixture(`
      import { createEffect as createSolidEffect } from "solid-js";

      createSolidEffect(function () {
        document.title = "note";
      });
    `);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("createEffect requires an adjacent intent comment");
  });
});

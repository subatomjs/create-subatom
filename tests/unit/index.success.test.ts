/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prompt.ts", () => ({
	runPrompts: vi.fn().mockResolvedValue({
		projectName: "app",
		language: "ts",
		orm: "prisma",
		database: "postgresql",
		useRedis: false,
		useEslint: false,
		useVitest: false,
		useSocket: false,
	}),
}));

vi.mock(
	"../../src/helpers/copy-template/handleCopyTemplate.ts",
	() => ({
		default: vi.fn().mockResolvedValue(undefined),
	}),
);

vi.mock(
	"../../src/helpers/packages/package-json/mergePackageJson.ts",
	() => ({
		default: vi.fn().mockResolvedValue(undefined),
	}),
);

vi.mock("../../src/helpers/installDeps.ts", () => ({
	installDeps: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/helpers/gitInit.ts", () => ({
	gitInit: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Important:
 *
 * The CLI success test should not execute the real scaffold transaction.
 * The transaction performs real filesystem operations and would create
 * <cwd>/app when process.argv[2] is "app".
 *
 * The actual transaction implementation is covered separately by the
 * scaffoldTransaction tests.
 */
vi.mock("../../src/helpers/scaffoldTransaction.ts", () => ({
	withScaffoldTransaction: vi.fn(
		async (
			_targetDir: string,
			action: (stagedDir: string) => Promise<unknown>,
		) => {
			// Use a fake staging directory so no filesystem is touched.
			return action("/tmp/subatom-test-staging");
		},
	),
}));

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	spinner: vi.fn(() => ({
		start: vi.fn(),
		stop: vi.fn(),
	})),
	cancel: vi.fn(),
}));

describe("CLI index main flow — success", () => {
	afterEach(() => {
		// Never leak CLI arguments into another test.
		delete process.argv[2];

		vi.clearAllMocks();
	});

	it("runs successful flow without exiting", async () => {
		vi.resetModules();

		// Set argv so resolveProjectNameArg returns immediately.
		process.argv[2] = "app";

		const copyTemplate = (await import(
			"../../src/helpers/copy-template/handleCopyTemplate.ts"
		)) as any;

		const mergePkg = (await import(
			"../../src/helpers/packages/package-json/mergePackageJson.ts"
		)) as any;

		const install = await import("../../src/helpers/installDeps.ts");
		const git = await import("../../src/helpers/gitInit.ts");
		const transaction = await import(
			"../../src/helpers/scaffoldTransaction.ts"
		);
		const clack = await import("@clack/prompts");

		// Import and call main after all mocks are registered.
		const mod = await import("../../src/bin/create.ts");

		await mod.main();

		expect(transaction.withScaffoldTransaction).toHaveBeenCalled();

		expect(copyTemplate.default).toHaveBeenCalled();
		expect(mergePkg.default).toHaveBeenCalled();
		expect(install.installDeps).toHaveBeenCalled();
		expect(git.gitInit).toHaveBeenCalled();
		expect(clack.outro).toHaveBeenCalled();
	});
});


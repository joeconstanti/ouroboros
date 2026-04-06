import { z } from "zod";

/**
 * Project info schema
 */
export const ProjectSchema = z.object({
	name: z.string().default(""),
	language: z.string().default(""),
	framework: z.string().default(""),
	description: z.string().default(""),
});

/**
 * Commands schema
 */
export const CommandsSchema = z.object({
	test: z.string().default(""),
	lint: z.string().default(""),
	build: z.string().default(""),
});

/**
 * Boundaries schema
 */
export const BoundariesSchema = z.object({
	never_touch: z.array(z.string()).default([]),
});

/**
 * Full Ouroboros config schema
 */
export const OuroborosConfigSchema = z.object({
	project: ProjectSchema.default({}),
	commands: CommandsSchema.default({}),
	rules: z.array(z.string()).default([]),
	boundaries: BoundariesSchema.default({}),
});

/**
 * Ouroboros configuration from .ouroboros/config.yaml
 */
export type OuroborosConfig = z.infer<typeof OuroborosConfigSchema>;

/**
 * Experiment mode config (.ouroboros/experiment.yaml) — mirrors bash experiment mode.
 */
export const ExperimentEvaluatorSchema = z.object({
	command: z.string(),
});

export const ExperimentPrimaryMetricSchema = z.object({
	direction: z.enum(["min", "max"]).default("min"),
	improvement_threshold: z.coerce.number().default(0),
});

export const ExperimentConfigSchema = z.object({
	evaluator: ExperimentEvaluatorSchema,
	primary_metric: ExperimentPrimaryMetricSchema,
	max_attempts: z.coerce.number().int().positive().default(10),
	wall_clock_budget_sec: z.coerce.number().int().positive().default(3600),
	eval_timeout_sec: z.coerce.number().int().positive().default(600),
	base_branch: z.string().optional(),
	allowed_paths: z.array(z.string()).default(["**"]),
	forbidden_paths: z.array(z.string()).default([]),
	program_file: z.string().default(".ouroboros/programs/autoresearch.md"),
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

/**
 * Runtime options parsed from CLI args
 */
export interface RuntimeOptions {
	/** Skip running tests */
	skipTests: boolean;
	/** Skip running lint */
	skipLint: boolean;
	/** AI engine to use */
	aiEngine: string;
	/** Dry run mode (don't execute) */
	dryRun: boolean;
	/** Maximum iterations (0 = unlimited) */
	maxIterations: number;
	/** Maximum retries per task */
	maxRetries: number;
	/** Delay between retries in seconds */
	retryDelay: number;
	/** Verbose output */
	verbose: boolean;
	/** Create branch per task */
	branchPerTask: boolean;
	/** Base branch for PRs */
	baseBranch: string;
	/** Create PR after task */
	createPr: boolean;
	/** Create draft PR */
	draftPr: boolean;
	/** Run tasks in parallel */
	parallel: boolean;
	/** Maximum parallel agents */
	maxParallel: number;
	/** PRD source type */
	prdSource: "markdown" | "yaml" | "github";
	/** PRD file path */
	prdFile: string;
	/** GitHub repo (owner/repo) */
	githubRepo: string;
	/** GitHub issue label filter */
	githubLabel: string;
	/** Auto-commit changes */
	autoCommit: boolean;
	/** Autoresearch-style experiment loop */
	experimentMode: boolean;
	/** Path to experiment.yaml */
	experimentFile: string;
}

/**
 * Default runtime options
 */
export const DEFAULT_OPTIONS: RuntimeOptions = {
	skipTests: false,
	skipLint: false,
	aiEngine: "opencode",
	dryRun: false,
	maxIterations: 0,
	maxRetries: 3,
	retryDelay: 5,
	verbose: false,
	branchPerTask: false,
	baseBranch: "",
	createPr: false,
	draftPr: false,
	parallel: false,
	maxParallel: 3,
	prdSource: "markdown",
	prdFile: "PRD.md",
	githubRepo: "",
	githubLabel: "",
	autoCommit: true,
	experimentMode: false,
	experimentFile: ".ouroboros/experiment.yaml",
};

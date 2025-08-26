import { Command, Option } from 'commander';
import chalk from 'chalk';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normalizeLanguageInput } from '../utils/languageMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

/**
 * Banner, yo!
 *
 * @since 1.0.0
 */
const BANNER = `

      ___          ___       ___          ___          ___          ___       ___                     ___
     /\\  \\        /\\  \\     /\\  \\        /\\  \\        /\\__\\        /\\  \\     /\\  \\         ___       /\\  \\
    /::\\  \\      /::\\  \\    \\:\\  \\      /::\\  \\      /::|  |      /::\\  \\    \\:\\  \\       /\\  \\     /::\\  \\
   /:/\\:\\  \\    /:/\\:\\  \\    \\:\\  \\    /:/\\:\\  \\    /:|:|  |     /:/\\:\\  \\    \\:\\  \\      \\:\\  \\   /:/\\:\\  \\
  /::\\~\\:\\  \\  /:/  \\:\\  \\   /::\\  \\  /:/  \\:\\  \\  /:/|:|__|__  /::\\~\\:\\  \\   /::\\  \\     /::\\__\\ /:/  \\:\\  \\
 /:/\\:\\ \\:\\__\\/:/__/ \\:\\__\\ /:/\\:\\__\\/:/__/ \\:\\__\\/:/ |::::\\__\\/:/\\:\\ \\:\\__\\ /:/\\:\\__\\ __/:/\\/__//:/__/ \\:\\__\\
 \\/__\\:\\/:/  /\\:\\  \\ /:/  //:/  \\/__/\\:\\  \\ /:/  /\\/__/~~/:/  /\\/__\\:\\/:/  //:/  \\/__//\\/:/  /   \\:\\  \\  \\/__/
      \\::/  /  \\:\\  /:/  //:/  /      \\:\\  /:/  /       /:/  /      \\::/  //:/  /     \\::/__/     \\:\\  \\
       \\/__/    \\:\\/:/  / \\/__/        \\:\\/:/  /       /:/  /       /:/  / \\/__/       \\:\\__\\      \\:\\  \\
                 \\::/  /                \\::/  /       /:/  /       /:/  /               \\/__/       \\:\\__\\
                  \\/__/                  \\/__/        \\/__/        \\/__/                             \\/__/
`;

/**
 * Displays the banner with version information.
 *
 * @since 1.0.0
 *
 * @return {void}
 */
export function displayBanner() {
	console.log(chalk.cyan(BANNER));
	console.log(chalk.gray(`Potomatic - AI-powered translation utility for .pot files ${packageJson.version ? `| v${packageJson.version}` : ''}\n`));
}

/**
 * Schema for environment variable validation and parsing.
 */
const envSchema = z.object({
	// Provider settings.
	PROVIDER: z.string().default('openai'),

	// Provider API key.
	API_KEY: z.string().optional(),

	// Model settings.
	MODEL: z.string().default('gpt-4o-mini'),

	// Performance settings.
	BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
	CONCURRENT_JOBS: z.coerce.number().int().min(1).max(10).default(2),
	TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
	TIMEOUT: z.coerce.number().int().min(10).max(300).default(60),
	MAX_TOKENS: z.coerce.number().int().min(1).max(32768).optional(),

	// Retry settings.
	MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
	RETRY_DELAY: z.coerce.number().int().min(500).max(30000).default(2000),
	ABORT_ON_FAILURE: z.coerce.boolean().default(false),
	SKIP_LANGUAGE_ON_FAILURE: z.coerce.boolean().default(false),

	// Testing settings.
	TEST_RETRY_FAILURE_RATE: z.coerce.number().min(0).max(1).optional(),
	TEST_ALLOW_COMPLETE_FAILURE: z.coerce.boolean().default(false),

	// Limits.
	MAX_COST: z.coerce.number().min(0.001).optional(),
	MAX_STRINGS_PER_JOB: z.coerce.number().int().min(1).optional(),
	MAX_TOTAL_STRINGS: z.coerce.number().int().min(1).optional(),

	// Paths and files.
	OUTPUT_DIR: z.string().default('.'),
	PO_FILE_PREFIX: z.string().optional(),
	INPUT_PO_PATH: z.string().optional(),

	// Dictionary settings.
	DICTIONARY_PATH: z.string().default('./config/dictionaries'),
	USE_DICTIONARY: z.coerce.boolean().default(false),

	// Optional target languages and pot file (can set defaults.).
	TARGET_LANGUAGES: z.string().optional(),
	POT_FILE_PATH: z.string().optional(),
	SOURCE_LANGUAGE: z.string().default('en'),

	// Locale format for file naming.
	LOCALE_FORMAT: z.enum(['wp_locale', 'iso_639_1', 'iso_639_2', 'target_lang']).default('target_lang'),

	// Output format options.
	OUTPUT_FORMAT: z.enum(['console', 'json']).default('console'),
	OUTPUT_FILE: z.string().optional(),

	// Debug and behavior.
	VERBOSE_LEVEL: z.coerce.number().int().min(0).max(3).default(1),
	SAVE_DEBUG_INFO: z.coerce.boolean().default(false),
	DRY_RUN: z.coerce.boolean().default(false),
	FORCE_TRANSLATE: z.coerce.boolean().default(false),
	RICH_PROGRESS: z.coerce.boolean().default(false),
});

/**
 * Parses and validates environment variables.
 *
 * @since 1.0.0
 *
 * @return {Object} Validated environment configuration.
 */
function parseEnvironmentConfig() {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		console.error('❌ Environment configuration error:');

		if (error instanceof z.ZodError) {
			error.errors.forEach((err) => {
				console.error(`  - ${err.path.join('.')}: ${err.message}`);
			});
		} else {
			console.error(`  - ${error.message}`);
		}

		process.exit(1);
	}
}

// Parse environment configuration once at module load.
const ENV_CONFIG = parseEnvironmentConfig();

/**
 * Default configuration constants.
 *
 * @since 1.0.0
 */
export const DEFAULTS = {
	PROVIDER: ENV_CONFIG.PROVIDER,
	BATCH_SIZE: ENV_CONFIG.BATCH_SIZE,
	MODEL: ENV_CONFIG.MODEL,
	VERBOSE_LEVEL: ENV_CONFIG.VERBOSE_LEVEL,
	PO_FILE_PREFIX: ENV_CONFIG.PO_FILE_PREFIX,
	INPUT_PO_PATH: ENV_CONFIG.INPUT_PO_PATH,
	CONCURRENT_JOBS: ENV_CONFIG.CONCURRENT_JOBS,
	MAX_RETRIES: ENV_CONFIG.MAX_RETRIES,
	RETRY_DELAY: ENV_CONFIG.RETRY_DELAY,
	ABORT_ON_FAILURE: ENV_CONFIG.ABORT_ON_FAILURE,
	SKIP_LANGUAGE_ON_FAILURE: ENV_CONFIG.SKIP_LANGUAGE_ON_FAILURE,
	TEMPERATURE: ENV_CONFIG.TEMPERATURE,
	TIMEOUT: ENV_CONFIG.TIMEOUT,
	MAX_TOKENS: ENV_CONFIG.MAX_TOKENS,
	MAX_COST: ENV_CONFIG.MAX_COST,
	MAX_STRINGS_PER_JOB: ENV_CONFIG.MAX_STRINGS_PER_JOB,
	MAX_TOTAL_STRINGS: ENV_CONFIG.MAX_TOTAL_STRINGS,
	OUTPUT_DIR: ENV_CONFIG.OUTPUT_DIR,
	SAVE_DEBUG_INFO: ENV_CONFIG.SAVE_DEBUG_INFO,
	DRY_RUN: ENV_CONFIG.DRY_RUN,
	FORCE_TRANSLATE: ENV_CONFIG.FORCE_TRANSLATE,
	RICH_PROGRESS: ENV_CONFIG.RICH_PROGRESS,
	TARGET_LANGUAGES: ENV_CONFIG.TARGET_LANGUAGES,
	POT_FILE_PATH: ENV_CONFIG.POT_FILE_PATH,
	TEST_RETRY_FAILURE_RATE: ENV_CONFIG.TEST_RETRY_FAILURE_RATE,
	TEST_ALLOW_COMPLETE_FAILURE: ENV_CONFIG.TEST_ALLOW_COMPLETE_FAILURE,
	SOURCE_LANGUAGE: ENV_CONFIG.SOURCE_LANGUAGE,
	OUTPUT_FORMAT: ENV_CONFIG.OUTPUT_FORMAT,
	OUTPUT_FILE: ENV_CONFIG.OUTPUT_FILE,
	LOCALE_FORMAT: ENV_CONFIG.LOCALE_FORMAT,
	DICTIONARY_PATH: ENV_CONFIG.DICTIONARY_PATH,
	USE_DICTIONARY: ENV_CONFIG.USE_DICTIONARY,
};

/**
 * Parses command line arguments and sets up the CLI interface.
 * Creates a Commander.js program with all available options and validates input.
 * Environment variables provide defaults for all options.
 *
 * @since 1.0.0
 *
 * @return {Object} Parsed command line options object.
 */
export function parseCliArguments() {
	const program = new Command();

	program
		.version(packageJson.version)
		// === Required Options (can be set via env vars) ==.=
		.option(
			'-l, --target-languages <languages>',
			'Target locale codes, comma-separated (e.g., fr_FR, es_ES, de_DE)',
			(value, previous) => {
				const langs = value

					.split(',')
					.map((lang) => lang.trim())
					.filter((lang) => lang.length > 0);

				const isFirstCliArgument = Array.isArray(previous) && previous.length > 0 && DEFAULTS.TARGET_LANGUAGES && previous.join(',') === DEFAULTS.TARGET_LANGUAGES;

				return isFirstCliArgument ? langs : previous.concat(langs);
			},
			DEFAULTS.TARGET_LANGUAGES ? DEFAULTS.TARGET_LANGUAGES.split(',').map((lang) => lang.trim()) : []
		)
		.option('-p, --pot-file-path <path>', 'Path to the input `.pot` file containing source strings', DEFAULTS.POT_FILE_PATH)
		.option('-s, --source-language <lang>', 'Source language code (default: "en")', DEFAULTS.SOURCE_LANGUAGE)

		// === Output Options ==.=
		.option('-o, --output-dir <path>', 'Directory to save generated `.po` files for each language', DEFAULTS.OUTPUT_DIR)
		.option('--output-format <format>', 'Output format: `console` or `json` (default: console)', DEFAULTS.OUTPUT_FORMAT)
		.option('--output-file <path>', 'Path to save JSON output (use stdout if not provided)', DEFAULTS.OUTPUT_FILE)
		.option('--po-file-prefix <prefix>', 'Prefix for each output `.po` file (e.g., "app-" → "app-fr_FR.po")', DEFAULTS.PO_FILE_PREFIX)
		.option('--locale-format <format>', 'Format to use for locale codes in file names: `wp_locale` (ru_RU), `iso_639_1` (ru), `iso_639_2` (rus), or `target_lang` (default)', DEFAULTS.LOCALE_FORMAT)

		// === Translation Options ==.=
		.option('--provider <provider>', 'AI provider to use (e.g., "openai", "gemini")', DEFAULTS.PROVIDER)
		.option('-k, --api-key <key>', 'Provider API key (overrides API_KEY env var)')
		.option('-m, --model <model>', 'AI model name (e.g., "gpt-4o-mini")', DEFAULTS.MODEL)
		.option('--temperature <number>', 'Creativity level (0.0-2.0); lower = more deterministic, higher = more creative', (val) => Math.max(0, Math.min(2, parseFloat(val))), DEFAULTS.TEMPERATURE)
		.option('-F, --force-translate', 'Re-translate all strings, ignoring any existing translations', DEFAULTS.FORCE_TRANSLATE)
		.option('--input-po-path <path>', 'Path to an existing `.po` file to use as a base for merging', DEFAULTS.INPUT_PO_PATH)

		// === Dictionary Options ==.=
		.option('--dictionary-path <path>', 'Directory containing translation dictionaries (default: ./config/dictionaries)', DEFAULTS.DICTIONARY_PATH)
		.option('--use-dictionary', 'Use user dictionary for consistent term translation', DEFAULTS.USE_DICTIONARY)

		// === Performance Options ==.=
		.option('-b, --batch-size <number>', 'Number of strings per translation batch (1-100). Larger batches reduce cost but increase risk of API failures.', (val) => Math.max(1, Math.min(100, parseInt(val, 10))), DEFAULTS.BATCH_SIZE)
		.option('-j, --jobs <number>', 'Maximum number of languages to translate in parallel (1-10)', (val) => Math.max(1, Math.min(10, parseInt(val, 10))), DEFAULTS.CONCURRENT_JOBS)
		.option('--max-tokens <number>', 'Maximum completion tokens for AI responses (1-32768, auto-calculated if not set)', (val) => Math.max(1, Math.min(32768, parseInt(val, 10))), DEFAULTS.MAX_TOKENS)
		.option('--max-strings-per-job <number>', 'Limit the number of strings translated per language (for testing)', (val) => Math.max(1, parseInt(val, 10)), DEFAULTS.MAX_STRINGS_PER_JOB)
		.option('--max-total-strings <number>', 'Limit total number of strings translated across all languages (processed sequentially)', (val) => Math.max(1, parseInt(val, 10)), DEFAULTS.MAX_TOTAL_STRINGS)
		.option('--max-cost <number>', 'Limit total estimated translation cost in USD', (val) => parseFloat(val), DEFAULTS.MAX_COST)

		// === Reliability Options ==.=
		.option('--max-retries <number>', 'Number of retry attempts per batch (0-10)', (val) => Math.max(0, Math.min(10, parseInt(val, 10))), DEFAULTS.MAX_RETRIES)
		.option('--retry-delay <number>', 'Delay between retry attempts in milliseconds (500-30000)', (val) => Math.max(500, Math.min(30000, parseInt(val, 10))), DEFAULTS.RETRY_DELAY)
		.option('--abort-on-failure', 'Abort the entire translation run if any batch fails all retry attempts', DEFAULTS.ABORT_ON_FAILURE)
		.option('--skip-language-on-failure', 'Skip current language on failure and continue with remaining languages', DEFAULTS.SKIP_LANGUAGE_ON_FAILURE)
		.option('--timeout <number>', 'Timeout for API requests in seconds (10-300)', (val) => Math.max(10, Math.min(300, parseInt(val, 10))), DEFAULTS.TIMEOUT)

		// === Debugging Options ==.=
		.addOption(
			new Option('-v, --verbose-level <level>', 'Verbosity level: 0=errors, 1=normal, 2=verbose, 3=debug').default(DEFAULTS.VERBOSE_LEVEL.toString()).argParser((value) => {
				const parsed = parseInt(value, 10);

				return isNaN(parsed) ? DEFAULTS.VERBOSE_LEVEL : Math.max(0, Math.min(3, parsed));
			})
		)
		.option('--dry-run', 'Simulate translation without making actual API calls', DEFAULTS.DRY_RUN)
		.option('--save-debug-info', 'Save detailed request/response logs to timestamped files in the `debug/` directory', DEFAULTS.SAVE_DEBUG_INFO)
		.option('--test-retry-failure-rate <rate>', '[Testing] Simulate API failure rate (0.0-1.0) to test retry logic', (val) => Math.max(0, Math.min(1, parseFloat(val))), DEFAULTS.TEST_RETRY_FAILURE_RATE)
		.option('--test-allow-complete-failure', '[Testing] Allow complete failure of a batch (disables final fallback)', DEFAULTS.TEST_ALLOW_COMPLETE_FAILURE);

	const hasEnvDefaults = DEFAULTS.TARGET_LANGUAGES && DEFAULTS.POT_FILE_PATH;
	const shouldShowHelp = process.argv.length <= 2 && !hasEnvDefaults;

	if (shouldShowHelp) {
		displayBanner();

		const tempOptions = {
			apiKey: ENV_CONFIG.API_KEY,
			targetLanguages: DEFAULTS.TARGET_LANGUAGES ? DEFAULTS.TARGET_LANGUAGES.split(',').map((lang) => lang.trim()) : [],
			potFilePath: DEFAULTS.POT_FILE_PATH,
			dryRun: false,
		};

		const validation = validateConfiguration(tempOptions);

		if (!validation.isValid) {
			validation.errors.forEach((error) => {
				console.error(chalk.yellow(`  ${error}`));
			});

			console.error();
		}

		program.help();
	}

	const parsed = program.parse(process.argv);
	const options = parsed.opts();

	delete options._shouldShowHelp;

	return options;
}

/**
 * Validates the configuration and checks for required parameters.
 * Ensures all essential settings are provided either via CLI or environment.
 *
 * @since 1.0.0
 *
 * @param {Object} options - Configuration options from CLI and environment.
 *
 * @return {Object} Validation result with isValid flag and error messages.
 */
export function validateConfiguration(options) {
	const errors = [];

	if (!options.dryRun && !options.apiKey && !process.env.API_KEY) {
		errors.push('🔑 API key required (set API_KEY env var, use --api-key, or try --dry-run)');
	}

	if (!options.targetLanguages || options.targetLanguages.length === 0) {
		errors.push('🌍 Target language required (use --target-languages)');
	}

	if (!options.potFilePath) {
		errors.push('📄 POT file required (use --pot-file-path)');
	}

	if (options.model && options.model.trim().length === 0) {
		errors.push('🤖 Model name cannot be empty.');
	}

	if (options.maxStringsPerJob && options.maxTotalStrings) {
		console.log(chalk.yellow('⚠️  Both --max-strings-per-job and --max-total-strings specified. Using --max-total-strings (sequential processing).'));
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Creates the final configuration object by merging CLI options with environment variables.
 * CLI options take precedence over environment variables.
 *
 * @since 1.0.0
 *
 * @param {Object} options - CLI options object.
 *
 * @return {Object} Complete configuration object ready for use.
 */
export function createConfiguration(options) {
	return {
		provider: options.provider || DEFAULTS.PROVIDER,
		apiKey: options.apiKey || ENV_CONFIG.API_KEY,
		model: options.model || DEFAULTS.MODEL,

		potFilePath: options.potFilePath || DEFAULTS.POT_FILE_PATH,
		targetLanguages: (options.targetLanguages || []).map((lang) => normalizeLanguageInput(lang)),
		outputDir: options.outputDir || DEFAULTS.OUTPUT_DIR,
		poFilePrefix: options.poFilePrefix || DEFAULTS.PO_FILE_PREFIX || '',
		inputPoPath: options.inputPoPath || DEFAULTS.INPUT_PO_PATH,

		batchSize: options.batchSize || DEFAULTS.BATCH_SIZE,
		concurrentJobs: options.jobs || DEFAULTS.CONCURRENT_JOBS,
		temperature: options.temperature || DEFAULTS.TEMPERATURE,
		timeout: options.timeout || DEFAULTS.TIMEOUT,
		maxTokens: options.maxTokens || DEFAULTS.MAX_TOKENS,

		maxStrings: options.maxStringsPerJob || DEFAULTS.MAX_STRINGS_PER_JOB,
		maxStringsTotal: options.maxTotalStrings || DEFAULTS.MAX_TOTAL_STRINGS,
		maxCost: options.maxCost || DEFAULTS.MAX_COST,

		maxRetries: options.maxRetries || DEFAULTS.MAX_RETRIES,
		retryDelayMs: options.retryDelay || DEFAULTS.RETRY_DELAY,
		stopOnMaxRetriesFailure: options.abortOnFailure || DEFAULTS.ABORT_ON_FAILURE,
		skipJobOnMaxRetriesFailure: options.skipLanguageOnFailure || DEFAULTS.SKIP_LANGUAGE_ON_FAILURE,

		forceTranslate: options.forceTranslate || DEFAULTS.FORCE_TRANSLATE,
		dryRun: options.dryRun || DEFAULTS.DRY_RUN,
		saveDebugInfo: options.saveDebugInfo || DEFAULTS.SAVE_DEBUG_INFO,
		verboseLevel: options.verboseLevel || DEFAULTS.VERBOSE_LEVEL,
		testRetryFailureRate: options.testRetryFailureRate || DEFAULTS.TEST_RETRY_FAILURE_RATE,
		testAllowCompleteFailure: options.testAllowCompleteFailure || DEFAULTS.TEST_ALLOW_COMPLETE_FAILURE,
		sourceLanguage: options.sourceLanguage || DEFAULTS.SOURCE_LANGUAGE,
		outputFormat: options.outputFormat || DEFAULTS.OUTPUT_FORMAT,
		outputFile: options.outputFile || DEFAULTS.OUTPUT_FILE,
		localeFormat: options.localeFormat || DEFAULTS.LOCALE_FORMAT,
		dictionaryPath: options.dictionaryPath || DEFAULTS.DICTIONARY_PATH,
		useDictionary: options.useDictionary || DEFAULTS.USE_DICTIONARY,
	};
}

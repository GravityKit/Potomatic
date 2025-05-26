import { BaseReporter } from './base/BaseReporter.js';
import { printDetailedLogs } from '../logging/index.js';
import { printTranslationRunSummary } from '../utils/reportingUtils.js';
import { defaultChalk } from '../utils/colorUtils.js';

/**
 * Console Reporter Implementation.
 *
 * Outputs translation results to the console using colored formatting.
 * Provides detailed logs and summary information based on verbosity level.
 *
 * @since 1.0.0
 */
export class ConsoleReporter extends BaseReporter {
	/**
	 * Creates a new Console Reporter instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} options - Console reporter configuration.
	 */
	constructor(options = {}) {
		super(options);
		this.config = options;
		this.logger = options.logger;
	}

	/**
	 * Validates console reporter configuration.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration to validate.
	 *
	 * @return {Object} Validation result.
	 */
	validateConfig(config) {
		const errors = [];

		// Console reporter doesn't need special validation.
		// but could check for TTY support, color preferences, etc.
		if (config.outputFile) {
			errors.push('Console reporter does not support file output. Use JsonReporter for file output.');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Reports translation results to console.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} allLanguageStats - Array of language processing results.
	 * @param {number} startTime - Start timestamp in milliseconds.
	 * @param {number} endTime - End timestamp in milliseconds.
	 * @param {Object} logCollector - Log collector instance for detailed logs.
	 *
	 * @return {Promise<void>} Resolves when reporting is complete.
	 */
	async report(allLanguageStats, startTime, endTime, logCollector) {
		if (allLanguageStats.length === 0) {
			this.logger.warn('No language tasks were processed or no statistics were collected.');
			return;
		}

		// Print detailed logs if verbose enough.
		printDetailedLogs(logCollector, this.logger, this.config.verboseLevel);

		// Print summary using centralized color utility.
		printTranslationRunSummary(allLanguageStats, this.logger, defaultChalk, startTime, endTime);
	}

	/**
	 * Gets the reporter name.
	 *
	 * @since 1.0.0
	 *
	 * @return {string} Reporter name.
	 */
	getReporterName() {
		return 'console';
	}

	/**
	 * Gets supported output options for console reporter.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<string>} Supported output options.
	 */
	getSupportedOptions() {
		return ['verboseLevel', 'colors'];
	}

	/**
	 * Checks if reporter supports file output.
	 *
	 * @since 1.0.0
	 *
	 * @return {boolean} False - console reporter only outputs to console.
	 */
	supportsFileOutput() {
		return false;
	}

	/**
	 * Checks if reporter supports console output.
	 *
	 * @since 1.0.0
	 *
	 * @return {boolean} True - this is the primary purpose.
	 */
	supportsConsoleOutput() {
		return true;
	}

	/**
	 * Reports successful translation completion.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array|Object} results - Translation results to report.
	 *
	 * @return {void}
	 */
	reportSuccess(results) {
		const output = this.getOutputStream();

		output.write('\n✅ Translation completed successfully!\n\n');

		if (Array.isArray(results)) {
			results.forEach((result) => {
				const formatted = this.formatResult(result);

				output.write(`📋 ${formatted.language}: ${formatted.translatedStrings}/${formatted.totalStrings} strings translated`);
				if (formatted.cost) {
					output.write(` (Cost: $${formatted.cost.toFixed(4)})`);
				}
				output.write('\n');
			});
		} else {
			const formatted = this.formatResult(results);

			output.write(`📋 Result: ${formatted.translatedStrings}/${formatted.totalStrings} strings translated\n`);
		}

		output.write('\n');
	}

	/**
	 * Reports error during translation process.
	 *
	 * @since 1.0.0
	 *
	 * @param {Error} error - Error that occurred during translation.
	 * @param {Object} context - Additional context about the error.
	 *
	 * @return {void}
	 */
	reportError(error, context = {}) {
		const output = this.getErrorStream();

		output.write('\n❌ Translation failed!\n\n');
		output.write(`Error: ${error.message}\n`);

		if (context.language) {
			output.write(`Language: ${context.language}\n`);
		}

		if (context.batch) {
			output.write(`Batch: ${context.batch}\n`);
		}

		if (this.verboseLevel >= 2 && error.stack) {
			output.write(`\nStack trace:\n${error.stack}\n`);
		}

		output.write('\n');
	}

	/**
	 * Reports progress during translation.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} progress - Progress information object.
	 *
	 * @return {void}
	 */
	reportProgress(progress) {
		if (this.verboseLevel >= 1) {
			const output = this.getOutputStream();

			const { current, total, language, batch } = progress;

			const percentage = Math.round((current / total) * 100);
			const progressBar = this.createProgressBar(current, total);

			output.write(`\r🔄 ${language}: ${progressBar} ${percentage}% (${current}/${total})`);

			if (batch) {
				output.write(` - Batch ${batch}`);
			}
		}
	}

	/**
	 * Reports dry run results.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array|Object} results - Dry run results to report.
	 *
	 * @return {void}
	 */
	reportDryRun(results) {
		const output = this.getOutputStream();

		output.write('\n🧪 Dry run completed!\n\n');
		output.write('The following translations would be performed:\n\n');

		if (Array.isArray(results)) {
			results.forEach((result) => {
				const formatted = this.formatResult(result);

				output.write(`📋 ${formatted.language}: ${formatted.totalStrings} strings would be translated\n`);
			});
		} else {
			const formatted = this.formatResult(results);

			output.write(`📋 ${formatted.totalStrings} strings would be translated\n`);
		}

		output.write('\nNo API calls were made.\n\n');
	}

	/**
	 * Creates a simple progress bar
	 *
	 * @since 1.0.0
	 */
	createProgressBar(current, total, width = 20) {
		const percentage = current / total;
		const filled = Math.round(percentage * width);
		const empty = width - filled;

		return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
	}
}

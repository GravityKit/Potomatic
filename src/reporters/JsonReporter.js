import { BaseReporter } from './base/BaseReporter.js';
import fs from 'fs/promises';
import path from 'path';
import { createSummary, calculateAggregateTotals, formatNumber } from '../utils/costCalculations.js';
import { VALIDATION_TYPES, getTotalValidationIssues } from '../utils/validationStats.js';

/**
 * Reports translation results in JSON format.
 *
 * @since 1.0.0
 */
export class JsonReporter extends BaseReporter {
	constructor(options = {}) {
		super(options);

		this.results = [];
	}

	/**
	 * Main report method for generating complete translation reports.
	 * This is the primary interface used by the orchestrator.
	 *
	 * @param {Array} allLanguageStats - Array of language processing results.
	 * @param {number} startTime - Start timestamp in milliseconds.
	 * @param {number} endTime - End timestamp in milliseconds.
	 * @param {Object} logCollector - Log collector instance for detailed logs.
	 *
	 * @return {Promise<void>} Resolves when reporting is complete.
	 *
	 * @since 1.0.0
	 */
	async report(allLanguageStats, startTime, endTime, logCollector) {
		const durationMs = endTime - startTime;

		// Use centralized cost calculation.
		const totals = calculateAggregateTotals(allLanguageStats) || {};
		const summary = createSummary(allLanguageStats) || {};

		const reportData = {
			metadata: {
				version: '1.0.0',
				timestamp: new Date(endTime).toISOString(),
				duration_ms: durationMs,
				source_language: this.options.sourceLanguage || 'en',
				dry_run: totals.isDryRun || false,
				configuration: {
					model: this.options.model || 'gpt-3.5-turbo',
					batch_size: this.options.batchSize || 20,
					max_retries: this.options.maxRetries || 3,
					temperature: this.options.temperature || 0.1,
					provider: this.options.provider || 'openai',
				},
			},
			input: {
				pot_file: this.options.potFilePath || 'translations.pot',
				total_strings: allLanguageStats.reduce((sum, stat) => sum + (stat.totalStringsInPot || 0), 0),
				target_languages: allLanguageStats.map((stat) => stat.language),
			},
			jobs: allLanguageStats.map((stat) => this._formatJobResult(stat)),
			summary,
		};

		await this._outputReport(reportData);
	}

	/**
	 * Formats a single language processing result for JSON output.
	 *
	 * @param {Object} stat - Language processing statistics.
	 *
	 * @return {Object} Formatted job result.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 */
	_formatJobResult(stat) {
		const validation = {};

		for (const key of Object.keys(VALIDATION_TYPES)) {
			// Convert camelCase to snake_case for JSON output.
			const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

			validation[snakeKey] = stat.validationStats?.[key] || 0;
		}

		// Calculate total warnings count.
		const totalWarnings = getTotalValidationIssues(stat.validationStats);

		return {
			language: stat.language,
			status: stat.error ? 'error' : 'success',
			strings: {
				total: stat.totalStringsInPot || 0,
				translated: stat.translatedInRun || 0,
				already_translated: stat.alreadyTranslated || 0,
				skipped_due_to_budget: stat.skippedDueToBudget || 0,
				skipped_due_to_limits: stat.skippedDueToLimits || 0,
				failed: stat.failedInRun || 0,
				merged: stat.mergedFromExisting || 0,
				warnings: totalWarnings,
			},
			cost: {
				amount: stat.costData?.totalCost || 0,
				input_tokens: stat.costData?.totalPromptTokens || stat.costData?.inputTokens || 0,
				output_tokens: stat.costData?.totalCompletionTokens || stat.costData?.outputTokens || 0,
				total_tokens: stat.costData?.totalTokens || 0,
			},
			validation,
			output_file: stat.outputFile || `${stat.language}.po`,
			method: stat.method || 'api_translation',
			duration_ms: stat.duration || 0,
			errors: stat.error ? [stat.error] : [],
		};
	}

	/**
	 * Outputs the report data either to console or file.
	 *
	 * @param {Object} reportData - The complete report data.
	 *
	 * @return {Promise<void>} Resolves when output is complete.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 */
	async _outputReport(reportData) {
		if (this.options.outputFile) {
			// For file output, use raw numbers for programmatic consumption.
			const jsonOutput = JSON.stringify(reportData, null, 2);

			await this._writeToFile(jsonOutput);
		} else {
			// For console output, format numbers for human readability.
			const jsonOutput = JSON.stringify(reportData, this._createNumberFormattingReplacer(), 2);

			console.log(jsonOutput);
		}
	}

	/**
	 * Creates a JSON replacer function that formats numbers for human readability.
	 * This is used when outputting JSON to console to make large numbers more readable.
	 *
	 * @return {Function} JSON replacer function
	 *
	 * @private
	 *
	 * @since 1.0.0
	 */
	_createNumberFormattingReplacer() {
		return (key, value) => {
			// Format integer values that represent counts (but not costs, durations, or version numbers.).
			if (typeof value === 'number' && Number.isInteger(value) && value >= 1000) {
				// Don't format certain keys that should remain as raw numbers.
				const skipFormatting = ['duration_ms', 'amount', 'version'];

				if (!skipFormatting.some((skipKey) => key.includes(skipKey))) {
					return formatNumber(value);
				}
			}

			return value;
		};
	}

	/**
	 * Gets the reporter name.
	 *
	 * @return {string} Reporter name.
	 *
	 * @since 1.0.0
	 */
	getReporterName() {
		return 'json';
	}

	/**
	 * Gets supported output options for JSON reporter.
	 *
	 * @return {Array<string>} Supported output options.
	 *
	 * @since 1.0.0
	 */
	getSupportedOptions() {
		return ['outputFile', 'prettyPrint'];
	}

	/**
	 * Checks if reporter supports file output.
	 *
	 * @return {boolean} True - JSON reporter supports file output.
	 *
	 * @since 1.0.0
	 */
	supportsFileOutput() {
		return true;
	}

	/**
	 * Checks if reporter supports console output.
	 *
	 * @return {boolean} True - JSON reporter can output to console.
	 *
	 * @since 1.0.0
	 */
	supportsConsoleOutput() {
		return true;
	}

	/**
	 * Reports dry run results
	 *
	 * @since 1.0.0
	 */
	async reportDryRun(results) {
		// For dry run, we use the same report structure but mark it as dry run.
		const mockStats = Array.isArray(results) ? results : [results];
		const startTime = Date.now() - 1000; // Mock start time.
		const endTime = Date.now();

		await this.report(mockStats, startTime, endTime, null);
	}

	/**
	 * Writes JSON data to the specified output file.
	 *
	 * @param {string} jsonOutput - JSON string to write.
	 *
	 * @return {Promise<void>} Resolves when file is written.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 */
	async _writeToFile(jsonOutput) {
		try {
			const outputPath = path.resolve(this.options.outputFile);
			const outputDir = path.dirname(outputPath);

			// Ensure output directory exists.
			await fs.mkdir(outputDir, { recursive: true });

			// Write the JSON file.
			await fs.writeFile(outputPath, jsonOutput, 'utf8');

			console.log(`JSON report written to: ${outputPath}`);
		} catch (error) {
			throw new Error(`Failed to write JSON report: ${error.message}`);
		}
	}
}

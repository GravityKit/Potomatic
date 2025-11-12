import { getStyledColor, getBoldColor } from './colorUtils.js';
import { calculateAggregateTotals, formatCost, getCostLabel, formatNumber, formatDuration } from './costCalculations.js';
import { getTotalValidationIssues } from './validationStats.js';

/**
 * Creates a logger with configurable verbosity levels.
 * Provides colored output using the centralized color utility for consistent styling.
 *
 * @since 1.0.0
 *
 * @param {number} verboseLevel - Logging verbosity level (0-3).
 * @param {Object} chalkInstance - Chalk instance for colored output.
 *
 * @return {Object} Logger object with error, warn, info, success, debug, log, and raw methods.
 */
export function createLogger(verboseLevel, chalkInstance) {
	return {
		/**
		 * Logs error messages.
		 * Always shown regardless of verbosity level.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Error message.
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		error: (message, ...optionalParams) => {
			if (verboseLevel < 0) {
				return;
			}

			const styledParams = optionalParams.map((param) => {
				if (param instanceof Error) {
					return chalkInstance.red(param.stack || param.message);
				}

				return param;
			});

			console.error(chalkInstance.redBright.bold('ERROR:'), chalkInstance.red(message), ...styledParams);
		},

		/**
		 * Logs warning messages.
		 * Shown at verbosity level 1 and above.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Warning message.
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		warn: (message, ...optionalParams) => {
			if (verboseLevel < 1) {
				return;
			}

			console.warn(chalkInstance.yellow('WARN:'), chalkInstance.yellow(message), ...optionalParams);
		},

		/**
		 * Logs informational messages with configurable verbosity.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Information message.
		 * @param {number} verbosity - Minimum verbosity level required (default: 1).
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		info: (message, verbosity = 1, ...optionalParams) => {
			if (verboseLevel < verbosity) {
				return;
			}

			console.log(chalkInstance.blueBright('INFO:'), chalkInstance.blueBright(message), ...optionalParams);
		},

		/**
		 * Logs success messages with configurable verbosity.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Success message.
		 * @param {number} verbosity - Minimum verbosity level required (default: 0).
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		success: (message, verbosity = 0, ...optionalParams) => {
			if (verboseLevel < verbosity) {
				return;
			}

			console.log(chalkInstance.greenBright.bold('SUCCESS:'), chalkInstance.green(message), ...optionalParams);
		},

		/**
		 * Logs debug messages.
		 * Shown at verbosity level 2 and above.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Debug message.
		 * @param {number} verbosity - Minimum verbosity level required (default: 2).
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		debug: (message, verbosity = 2, ...optionalParams) => {
			if (verboseLevel < verbosity) {
				return;
			}

			console.log(chalkInstance.gray('DEBUG:'), chalkInstance.gray(message), ...optionalParams);
		},

		/**
		 * Logs plain messages with configurable verbosity.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Message to log.
		 * @param {number} requiredLevel - Minimum verbosity level required (default: 1).
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		log: (message, requiredLevel = 1, ...optionalParams) => {
			if (verboseLevel < requiredLevel) {
				return;
			}

			console.log(message, ...optionalParams);
		},

		/**
		 * Logs raw messages without any formatting.
		 * Shown at verbosity level 2 and above by default.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} message - Raw message to log.
		 * @param {number} requiredLevel - Minimum verbosity level required (default: 2).
		 * @param {...any} optionalParams - Additional parameters to log.
		 */
		raw: (message, requiredLevel = 2, ...optionalParams) => {
			if (verboseLevel < requiredLevel) {
				return;
			}

			console.log(message, ...optionalParams);
		},
	};
}

/**
 * Prints a comprehensive summary of the translation run.
 * Shows statistics, results, cost information, and execution times for all processed languages.
 *
 * @since 1.0.0
 *
 * @param {Array} allLanguageStats - Array of language processing statistics.
 * @param {Object} logger - Logger instance for output.
 * @param {Object} effectiveChalk - Chalk instance (or no-op if disabled).
 * @param {number} startTime - Overall process start time in milliseconds.
 * @param {number} endTime - Overall process end time in milliseconds.
 */
export function printTranslationRunSummary(allLanguageStats, logger, effectiveChalk, startTime, endTime) {
	if (allLanguageStats.length === 0) {
		logger.warn('No language statistics available for summary.');
		return;
	}

	logger.info(getBoldColor('info')(''), 0);
	logger.info(getBoldColor('info')('=== TRANSLATION RUN SUMMARY ==='), 0);

	const totals = calculateAggregateTotals(allLanguageStats);

	// Calculate total execution time from overall start/end times when available.
	// Fall back to summing individual times for backward compatibility (e.g., when called without timing info).
	let totalExecutionTimeMs;
	if (startTime && endTime) {
		totalExecutionTimeMs = endTime - startTime;
	} else {
		totalExecutionTimeMs = allLanguageStats.reduce((sum, stat) => sum + (stat.executionTimeMs || 0), 0);
	}
	const totalExecutionTimeFormatted = formatDuration(totalExecutionTimeMs);

	// Count languages with warnings.
	const languagesWithWarnings = allLanguageStats.filter((stat) => {
		return stat.validationStats && getTotalValidationIssues(stat.validationStats) > 0;
	}).length;

	// Print overall results.
	const summaryParts = [
		`Languages processed: ${getStyledColor('success')(totals.languagesProcessed)}`,
		`With errors: ${getStyledColor('error')(totals.languagesWithErrors)}`,
	];

	if (languagesWithWarnings > 0) {
		summaryParts.push(`With warnings: ${getStyledColor('warning')(languagesWithWarnings)}`);
	}

	logger.info(summaryParts.join(' | '), 0);

	const resultParts = [];

	// Calculate detailed totals from all language stats.
	const totalAlreadyTranslated = allLanguageStats.reduce((sum, stat) => sum + (stat.alreadyTranslated || 0), 0);
	const totalSkippedDueToBudget = allLanguageStats.reduce((sum, stat) => sum + (stat.skippedDueToBudget || 0), 0);
	const totalSkippedDueToLimits = allLanguageStats.reduce((sum, stat) => sum + (stat.skippedDueToLimits || 0), 0);
	const totalFailed = allLanguageStats.reduce((sum, stat) => sum + (stat.failedInRun || 0), 0);

	// Order: Merged, Translated, Skipped, Failed.
	if (totalAlreadyTranslated > 0) {
		resultParts.push(`${getStyledColor('info')(formatNumber(totalAlreadyTranslated))} merged`);
	}

	resultParts.push(`${getStyledColor('success')(formatNumber(totals.totalTranslated))} translated`);

	const totalSkipped = totalSkippedDueToBudget + totalSkippedDueToLimits;

	if (totalSkipped > 0) {
		const skippedParts = [];

		if (totalSkippedDueToLimits > 0) {
			skippedParts.push(`${formatNumber(totalSkippedDueToLimits)} due to string limits`);
		}
		if (totalSkippedDueToBudget > 0) {
			skippedParts.push(`${formatNumber(totalSkippedDueToBudget)} due to cost limits`);
		}

		// Only show breakdown if there are multiple reasons for skipping.
		if (skippedParts.length > 1) {
			resultParts.push(`${getStyledColor('warn')(formatNumber(totalSkipped))} skipped (${skippedParts.join(', ')})`);
		} else {
			// Single reason - just show the reason without redundant total.
			const reason = totalSkippedDueToLimits > 0 ? 'due to string limits' : 'due to cost limits';

			resultParts.push(`${getStyledColor('warn')(formatNumber(totalSkipped))} skipped ${reason}`);
		}
	}

	if (totalFailed > 0) {
		resultParts.push(`${getStyledColor('error')(formatNumber(totalFailed))} failed`);
	}

	logger.info(`Total strings: ${resultParts.join(', ')}`, 0);

	// Print cost information using centralized formatting.
	const costLabel = getCostLabel(allLanguageStats);

	if (totals.totalCost > 0) {
		logger.info(`${costLabel}: ${getStyledColor('highlight')(formatCost(totals.totalCost))} | Total tokens: ${getStyledColor('info')(formatNumber(totals.totalTokens))}`, 0);
	}

	// Print execution time information.
	logger.info(`Total execution time: ${getStyledColor('info')(totalExecutionTimeFormatted)}`, 0);

	logger.info(getBoldColor('info')(''), 0);
	logger.info(getBoldColor('info')('Language Details:'), 0);

	// Show per-language details.
	allLanguageStats.forEach((stat) => {
		_printLanguageDetail(stat, logger);
	});

	logger.info(getBoldColor('info')(''), 0);
	logger.info(getBoldColor('info')('=== END SUMMARY ==='), 0);
}

/**
 * Prints detailed information for a single language.
 *
 * @private
 *
 * @since 1.0.0
 *
 * @param {Object} stat - Language statistics object.
 * @param {Object} logger - Logger instance for output.
 */
function _printLanguageDetail(stat, logger) {
	const languageCode = stat.language;

	if (stat.error) {
		const executionTime = stat.executionTimeMs ? formatDuration(stat.executionTimeMs) : 'N/A';

		logger.info(`  ${getStyledColor('error')(`✗ ${languageCode}`)} - Error: ${getStyledColor('error')(stat.error)} | Time: ${getStyledColor('muted')(executionTime)}`, 0);
		return;
	}

	// Use the shared buildLanguageResultLine function for consistent formatting.
	const line = buildLanguageResultLine(stat, {
		includeLanguageCode: true,
		styled: true,
	});

	logger.info(`  ${line}`, 0);
}

/**
 * Builds consistent result parts array for language statistics display.
 * Used by both orchestrator task titles and detailed summaries to ensure consistent terminology.
 *
 * @since 1.0.0
 *
 * @param {Object} stats - Language processing statistics.
 *
 * @return {Array} Array of result description strings.
 */
export function buildResultParts(stats) {
	const resultParts = [];

	// Show translated count.
	if (stats.translatedInRun > 0) {
		resultParts.push(`${formatNumber(stats.translatedInRun)} translated`);
	}

	// Show merged count (actual previously existing translations.).
	if (stats.mergedFromExisting > 0) {
		resultParts.push(`${formatNumber(stats.mergedFromExisting)} merged`);
	}

	// Show skipped counts with clear reasons.
	if (stats.skippedDueToLimits > 0) {
		resultParts.push(`${formatNumber(stats.skippedDueToLimits)} skipped due to string limits`);
	}

	if (stats.skippedDueToBudget > 0) {
		resultParts.push(`${formatNumber(stats.skippedDueToBudget)} skipped due to cost limits`);
	}

	// Show failed count.
	if (stats.failedInRun > 0) {
		resultParts.push(`${formatNumber(stats.failedInRun)} failed`);
	}

	return resultParts;
}

/**
 * Builds a complete formatted result line for a language with consistent formatting.
 * Used by both orchestrator task titles and detailed summaries to ensure identical output.
 *
 * @since 1.0.0
 *
 * @param {Object} stats - Language processing statistics.
 * @param {Object} options - Formatting options.
 * @param {boolean} options.includeLanguageCode - Whether to include language code prefix.
 * @param {boolean} options.styled - Whether to apply color styling.
 * @param {string} options.prefix - Prefix for the line (e.g., "Finished" or "✓").
 *
 * @return {string} Complete formatted result line.
 */
export function buildLanguageResultLine(stats, options = {}) {
	const { includeLanguageCode = true, styled = false, prefix = '' } = options;

	// Get the basic result parts.
	const resultParts = buildResultParts(stats);

	// Apply styling if requested.
	const formattedParts = styled
		? resultParts.map((part) => {
				if (part.includes('translated')) {
					return part.replace(/(\d+(?:,\d+)*) translated/, (match, num) => `${getStyledColor('success')(num)} translated`);
				} else if (part.includes('merged')) {
					return part.replace(/(\d+(?:,\d+)*) merged/, (match, num) => `${getStyledColor('info')(num)} merged`);
				} else if (part.includes('skipped')) {
					return part.replace(/(\d+(?:,\d+)*) skipped/, (match, num) => `${getStyledColor('warn')(num)} skipped`);
				} else if (part.includes('failed')) {
					return part.replace(/(\d+(?:,\d+)*) failed/, (match, num) => `${getStyledColor('error')(num)} failed`);
				}

				return part;
			})
		: resultParts;

	// Build the main content.
	let line = '';

	if (prefix && includeLanguageCode) {
		const languageDisplay = styled ? getStyledColor('success')(`${prefix} ${stats.language}`) : `${prefix} ${stats.language}`;

		line = `${languageDisplay}: ${formattedParts.join(', ')}`;
	} else if (includeLanguageCode) {
		const languageDisplay = styled ? getStyledColor('success')(`✓ ${stats.language}`) : `✓ ${stats.language}`;

		line = `${languageDisplay} - ${formattedParts.join(', ')}`;
	} else {
		line = formattedParts.join(', ');
	}

	// Add cost information.
	const cost = stats.costData?.totalCost || 0;

	if (cost > 0) {
		const costDisplay = stats.costData?.isDryRun ? `Cost (estimated): ${formatCost(cost)}` : `Cost: ${formatCost(cost)}`;
		const styledCost = styled ? getStyledColor('highlight')(costDisplay) : costDisplay;

		line += ` | ${styledCost}`;
	}

	// Add token information.
	const tokens = stats.costData?.totalTokens || 0;

	if (tokens > 0) {
		const tokenDisplay = `${formatNumber(tokens)} tokens`;
		const styledTokens = styled ? getStyledColor('info')(tokenDisplay) : tokenDisplay;

		line += ` | ${styledTokens}`;
	}

	// Add execution time.
	const executionTime = stats.executionTimeMs ? formatDuration(stats.executionTimeMs) : 'N/A';
	const styledTime = styled ? getStyledColor('info')(executionTime) : executionTime;

	line += ` | Time: ${styledTime}`;

	// Add output file.
	if (stats.outputFile) {
		const styledFile = styled ? getStyledColor('muted')(stats.outputFile) : stats.outputFile;

		line += ` | ${styledFile}`;
	}

	return line;
}

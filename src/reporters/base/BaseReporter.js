/**
 * Base Reporter Class
 *
 * Abstract base class for all reporter implementations.
 * Provides common interface and functionality for reporting translation results.
 *
 * @since 1.0.0
 */
export class BaseReporter {
	constructor(options = {}) {
		this.options = options;
		this.outputFormat = options.outputFormat || 'console';
		this.verboseLevel = options.verboseLevel || 1;
	}

	/**
	 * Reports successful translation completion
	 *
	 * @since 1.0.0
	 */
	reportSuccess(results) {
		throw new Error('BaseReporter.reportSuccess() must be implemented by subclass');
	}

	/**
	 * Reports error during translation process
	 *
	 * @since 1.0.0
	 */
	reportError(_error, context = {}) {
		throw new Error('BaseReporter.reportError() must be implemented by subclass');
	}

	/**
	 * Reports progress during translation
	 *
	 * @since 1.0.0
	 */
	reportProgress(progress) {
		throw new Error('BaseReporter.reportProgress() must be implemented by subclass');
	}

	/**
	 * Reports dry run results
	 *
	 * @since 1.0.0
	 */
	reportDryRun(results) {
		throw new Error('BaseReporter.reportDryRun() must be implemented by subclass');
	}

	/**
	 * Main report method for generating complete translation reports.
	 * This is the primary interface used by the orchestrator.
	 *
	 * @since 1.0.0
	 */
	report(allLanguageStats, startTime, endTime, logCollector) {
		throw new Error('BaseReporter.report() must be implemented by subclass');
	}

	/**
	 * Gets the reporter name (must be implemented by subclasses)
	 *
	 * @since 1.0.0
	 */
	getReporterName() {
		throw new Error('BaseReporter.getReporterName() must be implemented by subclass');
	}

	/**
	 * Validates reporter configuration
	 *
	 * @since 1.0.0
	 */
	validateConfig(config = {}) {
		// Base validation - can be overridden by subclasses.
		const errors = [];

		if (config.verboseLevel !== undefined && (config.verboseLevel < 0 || config.verboseLevel > 3)) {
			errors.push('Verbose level must be between 0 and 3');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Gets the output stream for writing
	 *
	 * @since 1.0.0
	 */
	getOutputStream() {
		return process.stdout;
	}

	/**
	 * Gets the error stream for writing
	 *
	 * @since 1.0.0
	 */
	getErrorStream() {
		return process.stderr;
	}

	/**
	 * Formats a result object for display
	 *
	 * @since 1.0.0
	 */
	formatResult(result) {
		if (typeof result === 'string') {
			return { language: 'unknown', translatedStrings: 1, totalStrings: 1 };
		}

		return {
			language: result.language || 'unknown',
			translatedStrings: result.translatedStrings || result.translated || 0,
			totalStrings: result.totalStrings || result.total || 0,
			cost: result.cost || null,
			errors: result.errors || [],
		};
	}
}

import { ConsoleReporter } from './ConsoleReporter.js';
import { JsonReporter } from './JsonReporter.js';

/**
 * Reporter Factory
 *
 * Creates reporter instances based on configuration.
 *
 * @since 1.0.0
 */
export class ReporterFactory {
	/**
	 * Creates a reporter instance based on the specified type
	 */
	static createReporter(type, options = {}) {
		// Handle case where first parameter is a config object.
		if (typeof type === 'object' && type !== null) {
			options = type;
			type = type.outputFormat || 'console';
		}

		// Normalize type to lowercase.
		if (typeof type === 'string') {
			type = type.toLowerCase();
		}

		const supportedFormats = this.getSupportedFormats().join(', ');

		switch (type) {
			case 'console':
				return new ConsoleReporter(options);

			case 'json':
				return new JsonReporter(options);

			default:
				throw new Error(`Unsupported output format: ${type}. Supported formats: ${supportedFormats}`);
		}
	}

	/**
	 * Gets available reporter types
	 */
	static getAvailableTypes() {
		return ['console', 'json'];
	}

	/**
	 * Validates reporter type
	 */
	static isValidType(type) {
		return this.getAvailableTypes().includes(type);
	}

	/**
	 * Gets default reporter type
	 */
	static getDefaultType() {
		return 'console';
	}

	/**
	 * Gets the list of supported output format names.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<string>} Array of supported format names.
	 */
	static getSupportedFormats() {
		return ['console', 'json'];
	}

	/**
	 * Validates that an output format is supported.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} formatName - Format name to validate.
	 *
	 * @return {boolean} True if format is supported.
	 */
	static isFormatSupported(formatName) {
		return ReporterFactory.getSupportedFormats().includes(formatName.toLowerCase());
	}

	/**
	 * Gets information about all reporters including capabilities.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<Object>} Reporter information objects.
	 */
	static getReporterInfo() {
		return [
			{
				name: 'console',
				displayName: 'Console',
				description: 'Colored console output with detailed logs and summary',
				supportsFileOutput: false,
				supportsConsoleOutput: true,
				supportedOptions: ['verboseLevel', 'colors'],
				configExample: {
					outputFormat: 'console',
					verboseLevel: 1,
				},
			},
			{
				name: 'json',
				displayName: 'JSON',
				description: 'Structured JSON output for programmatic consumption',
				supportsFileOutput: true,
				supportsConsoleOutput: true,
				supportedOptions: ['outputFile', 'prettyPrint'],
				configExample: {
					outputFormat: 'json',
					outputFile: 'results.json',
				},
			},
		];
	}

	/**
	 * Creates a reporter and validates its configuration.
	 * Provides detailed error messages for easier troubleshooting.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration object.
	 * @param {Object} logger - Logger instance.
	 *
	 * @return {Reporter} Validated reporter instance.
	 *
	 * @throws {Error} If reporter creation or validation fails.
	 */
	static createAndValidateReporter(config, logger) {
		// Check if format is supported.
		const outputFormat = config.outputFormat || 'console';

		if (!ReporterFactory.isFormatSupported(outputFormat)) {
			const supportedFormats = ReporterFactory.getSupportedFormats().join(', ');

			throw new Error(`Unsupported output format: ${outputFormat}. Supported: ${supportedFormats}`);
		}

		// Create reporter with logger included in options.
		const optionsWithLogger = { ...config, logger };
		const reporter = ReporterFactory.createReporter(outputFormat, optionsWithLogger);

		// Validate configuration.
		const validation = reporter.validateConfig(config);

		if (!validation.isValid) {
			const errorMessage = validation.errors.join(', ');

			throw new Error(`Reporter configuration invalid: ${errorMessage}`);
		}

		logger.debug(`Created and validated ${outputFormat} reporter`);

		return reporter;
	}

	/**
	 * Gets the default configuration for a reporter.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} formatName - Format name.
	 *
	 * @return {Object} Default configuration.
	 */
	static getDefaultConfig(formatName) {
		const defaults = {
			console: {
				verboseLevel: 1,
			},
			json: {
				prettyPrint: true,
			},
		};

		return defaults[formatName] || {};
	}

	/**
	 * Checks if a configuration requires file output.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration to check.
	 *
	 * @return {boolean} True if configuration specifies file output.
	 */
	static requiresFileOutput(config) {
		return !!config.outputFile;
	}

	/**
	 * Gets the appropriate reporter for file vs.console output.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration object.
	 * @param {Object} logger - Logger instance.
	 *
	 * @return {Reporter} Appropriate reporter instance.
	 */
	static getReporterForOutput(config, logger) {
		// If output file is specified, prefer JSON format unless explicitly set to console.
		if (config.outputFile && !config.outputFormat) {
			const jsonConfig = { ...config, outputFormat: 'json' };

			return ReporterFactory.createAndValidateReporter(jsonConfig, logger);
		}

		return ReporterFactory.createAndValidateReporter(config, logger);
	}
}

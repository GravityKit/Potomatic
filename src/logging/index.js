import { EventEmitter } from 'events';
import { createColorMap, getBoldColor, getStyledColor, defaultChalk as chalk } from '../utils/colorUtils.js';

/**
 * Collects and manages logs from multiple language processing operations.
 * Extends EventEmitter to provide real-time log event notifications.
 * Maintains separate log arrays for each language being processed.
 *
 * @since 1.0.0
 *
 * @extends EventEmitter
 */
export class LogCollector extends EventEmitter {
	/**
	 * Creates a new LogCollector instance.
	 * Initializes the internal logs Map for storing language-specific logs.
	 *
	 * @since 1.0.0
	 */
	constructor() {
		super();
		this.logs = new Map();
	}

	/**
	 * Creates and registers a new language-specific logger.
	 * If a logger for the language already exists, returns the existing one.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} languageCode - Language code (e.g., 'fr_FR', 'es_ES').
	 *
	 * @return {LanguageLogger} Language-specific logger instance.
	 */
	addLanguageLogger(languageCode) {
		if (!this.logs.has(languageCode)) {
			this.logs.set(languageCode, []);
		}

		return new LanguageLogger(languageCode, this);
	}

	/**
	 * Retrieves all logs for a specific language.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} languageCode - Language code to get logs for.
	 *
	 * @return {Array} Array of log entries for the specified language.
	 */
	getLogsFor(languageCode) {
		return this.logs.get(languageCode) || [];
	}

	/**
	 * Gets all logs for all languages as a plain object.
	 *
	 * @since 1.0.0
	 *
	 * @return {Object} Object with language codes as keys and log arrays as values.
	 */
	getAllLogs() {
		return Object.fromEntries(this.logs.entries());
	}

	/**
	 * Internal method to capture and store log entries.
	 * Adds logs to the appropriate language collection and emits log events.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} languageCode - Language code for log context.
	 * @param {string} level        - Log level (info, warn, error, success, debug, raw).
	 * @param {string} message      - Log message content.
	 * @param {string} timestamp    - ISO timestamp of the log entry.
	 */
	_captureLog(languageCode, level, message, timestamp) {
		const logs = this.logs.get(languageCode);

		if (logs) {
			logs.push({
				level,
				message,
				timestamp,
				formatted: `[${timestamp}] [${level.toUpperCase()}] ${message}`,
			});
		}

		this.emit('log', { languageCode, level, message, timestamp });
	}
}

/**
 * Language-specific logger that captures logs for a single language.
 * Provides standard logging methods and forwards entries to the LogCollector.
 *
 * @since 1.0.0
 */
class LanguageLogger {
	/**
	 * Creates a new LanguageLogger instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {string}       languageCode - Language code this logger handles.
	 * @param {LogCollector} collector    - Parent collector to send logs to.
	 */
	constructor(languageCode, collector) {
		this.languageCode = languageCode;
		this.collector = collector;
	}

	/**
	 * Internal logging method that adds timestamp and forwards to collector.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} level   - Log level.
	 * @param {string} message - Log message.
	 */
	_log(level, message) {
		const timestamp = new Date().toISOString();

		this.collector._captureLog(this.languageCode, level, message, timestamp);
	}

	/**
	 * Logs an informational message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Message to log.
	 */
	info(message) {
		this._log('info', message);
	}

	/**
	 * Logs a warning message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Warning message to log.
	 */
	warn(message) {
		this._log('warn', message);
	}

	/**
	 * Logs an error message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Error message to log.
	 */
	error(message) {
		this._log('error', message);
	}

	/**
	 * Logs a success message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Success message to log.
	 */
	success(message) {
		this._log('success', message);
	}

	/**
	 * Logs a debug message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Debug message to log.
	 */
	debug(message) {
		this._log('debug', message);
	}

	/**
	 * Logs a raw message without additional formatting.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} message - Raw message to log.
	 */
	raw(message) {
		this._log('raw', message);
	}

	/**
	 * Generic log method that supports dynamic levels.
	 * Concatenates additional arguments into the message.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} level - Log level.
	 * @param {string} message - Base message.
	 * @param {...any} args - Additional arguments to include in message.
	 */
	log(level, message, ...args) {
		const fullMessage = `${message} ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`;

		this._log(level, fullMessage);
	}
}

/**
 * Creates a console logger with configurable verbosity levels.
 * Provides colored output using the centralized color utility for consistent styling.
 *
 * @since 1.0.0
 *
 * @param {number} verboseLevel - Logging verbosity level (0-3)
 * @param {Object} chalkInstance - Chalk instance for colored output (defaults to chalk from colorUtils)
 *
 * @return {Object} Logger object with error, warn, info, success, debug, and log methods
 */
export function createLogger(verboseLevel, chalkInstance = chalk) {
	return {
		/**
		 * Logs error messages (always shown regardless of verbosity level).
		 *
		 * @param {string} message - Error message
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		error: (message, ...optionalParams) => {
			if (verboseLevel >= 0) {
				const labelColor = getBoldColor('error');
				const messageColor = getStyledColor('error');

				console.error(labelColor('ERROR:'), messageColor(message), ...optionalParams.map((p) => messageColor(p instanceof Error ? p.stack : p)));
			}
		},

		/**
		 * Logs warning messages (shown at verbosity level 1 and above).
		 *
		 * @param {string} message - Warning message
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		warn: (message, ...optionalParams) => {
			if (verboseLevel >= 1) {
				const labelColor = getBoldColor('warn');
				const messageColor = getStyledColor('warn');

				console.warn(labelColor('WARN:'), messageColor(message), ...optionalParams.map((p) => messageColor(p)));
			}
		},

		/**
		 * Logs informational messages with configurable verbosity.
		 *
		 * @param {string} message - Information message
		 * @param {number} verbosity - Minimum verbosity level required (default: 1)
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		info: (message, verbosity = 1, ...optionalParams) => {
			if (verboseLevel >= verbosity) {
				const labelColor = getBoldColor('info');
				const messageColor = getStyledColor('info');

				console.log(labelColor('INFO:'), messageColor(message), ...optionalParams.map((p) => messageColor(p)));
			}
		},

		/**
		 * Logs success messages with configurable verbosity.
		 *
		 * @param {string} message - Success message
		 * @param {number} verbosity - Minimum verbosity level required (default: 0)
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		success: (message, verbosity = 0, ...optionalParams) => {
			if (verboseLevel >= verbosity) {
				const labelColor = getBoldColor('success');
				const messageColor = getStyledColor('success');

				console.log(labelColor('SUCCESS:'), messageColor(message), ...optionalParams.map((p) => messageColor(p)));
			}
		},

		/**
		 * Logs debug messages (shown at verbosity level 2 and above).
		 *
		 * @param {string} message - Debug message
		 * @param {number} verbosity - Minimum verbosity level required (default: 2)
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		debug: (message, verbosity = 2, ...optionalParams) => {
			if (verboseLevel >= verbosity) {
				const labelColor = getBoldColor('debug');
				const messageColor = getStyledColor('debug');

				console.log(labelColor('DEBUG:'), messageColor(message), ...optionalParams.map((p) => messageColor(p)));
			}
		},

		/**
		 * Logs plain messages with configurable verbosity.
		 *
		 * @param {string} message - Message to log
		 * @param {number} requiredLevel - Minimum verbosity level required (default: 1)
		 * @param {...any} optionalParams - Additional parameters to log
		 */
		log: (message, requiredLevel = 1, ...optionalParams) => {
			if (verboseLevel >= requiredLevel) {
				console.log(message, ...optionalParams);
			}
		},
	};
}

/**
 * Prints detailed logs from the LogCollector in a formatted way.
 * Shows logs organized by language with appropriate color coding.
 *
 * @since 1.0.0
 *
 * @param {LogCollector} logCollector - LogCollector instance containing logs
 * @param {Object} mainLogger - Main logger for output
 * @param {number} verboseLevel - Current verbosity level
 * @param {number} minDisplayLevel - Minimum verbosity level to show detailed logs (default: 2)
 */
export function printDetailedLogs(logCollector, mainLogger, verboseLevel, minDisplayLevel = 2) {
	if (verboseLevel < minDisplayLevel) {
		return;
	}

	mainLogger.info(chalk.bold('--- Detailed Run Logs ---'), 0);

	for (const [languageCode, logs] of logCollector.logs.entries()) {
		mainLogger.info(chalk.bold(`\nLogs for Language: ${getStyledColor('highlight')(languageCode)}`), 0);

		if (logs.length === 0) {
			mainLogger.info(getStyledColor('muted')('(No logs captured for this language)'), 1);
			continue;
		}

		logs.forEach((log) => {
			// Skip debug logs if verbosity is too low.
			if (log.level === 'debug' && verboseLevel < 3) {
				return;
			}

			// Use centralized color mapping.
			const colorMap = createColorMap(['error', 'warn', 'success', 'info', 'debug'], 'simple');
			const colorFn = colorMap[log.level] || getStyledColor('neutral');

			console.log(colorFn(log.formatted));
		});
	}

	mainLogger.info(chalk.bold('--- End of Detailed Run Logs ---'), 0);
}

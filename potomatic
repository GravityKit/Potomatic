#!/usr/bin/env node

/**
 * Potomatic
 *
 * AI-powered translation utility for converting .pot files to multiple languages.
 *
 * @author GravityKit (https://www.gravitykit.com)
 * @copyright 2025 GravityKit
 * @license GPL-3.0-or-later
 * @version 1.0.0
 */

import 'dotenv/config';
import chalk from 'chalk';
import { parseCliArguments, createConfiguration, validateConfiguration } from './src/config/index.js';
import { createLogger } from './src/logging/index.js';
import { TranslationOrchestrator } from './src/orchestrator/index.js';

/**
 * Main entry point for the translation system.
 * Handles CLI argument parsing, configuration setup, logging initialization,
 * and orchestrates the complete translation workflow.
 *
 * @since 1.0.0
 *
 * @return {Promise<void>} Resolves when translation process completes.
 *
 * @throws {Error} If critical configuration or execution errors occur.
 */
async function main() {
	try {
		// Parse CLI arguments.
		const options = parseCliArguments();

		// Validate configuration before proceeding.
		const validation = validateConfiguration(options);
		if (!validation.isValid) {
			console.error(chalk.red('❌ Configuration validation failed:'));
			validation.errors.forEach((error) => {
				console.error(chalk.red(`  ${error}`));
			});
			process.exit(1);
		}

		// Create configuration.
		const config = createConfiguration(options);

		// Initialize main logger with adjusted verbosity for JSON output
		// When outputting JSON to stdout, suppress console logs to avoid mixing output
		let loggerVerbosity = config.verboseLevel;
		if (config.outputFormat === 'json' && !config.outputFile) {
			// JSON to stdout - suppress all console logs to keep output clean
			loggerVerbosity = 0;
		}
		const mainLogger = createLogger(loggerVerbosity);

		// Create and initialize orchestrator.
		const orchestrator = new TranslationOrchestrator(config, mainLogger);
		await orchestrator.initialize();

		// Process all languages.
		const exitCode = await orchestrator.processAllLanguages();

		process.exit(exitCode);
	} catch (error) {
		console.error('Fatal error:', error.message);

		process.exit(1);
	}
}

/**
 * Global unhandled promise rejection handler.
 * Ensures the process exits with error code when promises are rejected without handling.
 *
 * @since 1.0.0
 *
 * @param {any} reason - The rejection reason.
 * @param {Promise} promise - The promise that was rejected.
 */
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled promise rejection:', reason);

	process.exit(1);
});

/**
 * Error catch handler for the main function.
 * Provides additional safety net for errors not caught by the main try/catch.
 *
 * @since 1.0.0
 *
 * @param {Error} error - The unhandled error.
 */
main().catch((error) => {
	console.error('Unhandled error in main:', error);

	process.exit(1);
});

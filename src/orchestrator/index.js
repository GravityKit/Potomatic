import path from 'path';
import { Listr } from 'listr2';
import { LanguageProcessor } from '../processors/languageProcessor.js';
import { LogCollector } from '../logging/index.js';
import { printTranslationRunSummary, buildResultParts, buildLanguageResultLine } from '../utils/reportingUtils.js';
import { defaultChalk } from '../utils/colorUtils.js';
import { formatNumber } from '../utils/costCalculations.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ReporterFactory } from '../reporters/ReporterFactory.js';
import { getFileNamingLocale } from '../utils/languageMapping.js';
import { formatCount } from '../utils/pluralization.js';
import { getTotalValidationIssues, formatValidationBreakdown } from '../utils/validationStats.js';

/**
 * Main orchestrator class that coordinates the translation workflow.
 * Manages AI provider initialization, language processing tasks,
 * parallel execution, and result aggregation.
 *
 * @since 1.0.0
 */
export class TranslationOrchestrator {
	/**
	 * Creates a new TranslationOrchestrator instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config     - Configuration object containing all translation settings.
	 * @param {Object} mainLogger - Main logger instance for orchestrator messages.
	 */
	constructor(config, mainLogger) {
		this.config = config;
		this.mainLogger = mainLogger;
		this.logCollector = new LogCollector();
		this.provider = null;
		this.startTime = Date.now();
	}

	/**
	 * Initializes the orchestrator by setting up the AI provider.
	 * Must be called before processing languages.
	 *
	 * @since 1.0.0
	 *
	 * @return {Promise<void>} Resolves when initialization is complete.
	 */
	async initialize() {
		this.mainLogger.info(`Initializing translation orchestrator…`);

		await this._initializeProvider();

		this.mainLogger.info('Orchestrator initialized successfully');
	}

	/**
	 * Processes all target languages in parallel using Listr task runner.
	 * Coordinates language processing, handles errors, and generates summary reports.
	 * When maxStringsTotal is set, processes languages sequentially to enforce global limit.
	 *
	 * @since 1.0.0
	 *
	 * @return {Promise<number>} Exit code (0 for success, 1 for failure).
	 */
	async processAllLanguages() {
		this.mainLogger.info(`Starting translation process for ${formatCount(this.config.targetLanguages.length, 'language')}: ${this.config.targetLanguages.join(', ')}`);
		this.mainLogger.info(`Max concurrent jobs: ${this.config.concurrentJobs}`);
		this.mainLogger.info(`Output directory: ${path.resolve(this.config.outputDir)}`);

		if (this.config.poFilePrefix) {
			this.mainLogger.info(`Using .po file prefix: "${this.config.poFilePrefix}"`);
		}

		if (this.config.poHeaderTemplatePath) {
			this.mainLogger.info(`Using PO header template: ${this.config.poHeaderTemplatePath}`);
		}

		if (this.config.maxStringsTotal) {
			this.mainLogger.info(`String limit: ${formatNumber(this.config.maxStringsTotal)} total across all languages (processing sequentially)`);

			return await this._processLanguagesSequentially();
		}

		if (this.config.maxCost) {
			this.mainLogger.info(`Cost limit: $${this.config.maxCost.toFixed(4)} total across all languages (processing sequentially)`);

			return await this._processLanguagesWithCostLimit();
		}

		const tasks = this._createLanguageTasks();
		const listr = this._createListr(tasks);
		const allLanguageStats = [];
		let exitCode = 1;

		try {
			this.mainLogger.info('Starting language processing tasks…');

			const context = await listr.run();

			if (context && context.results) {
				allLanguageStats.push(...context.results);
			}

			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.success('All language processing tasks finished.');
			}
		} catch (error) {
			this.mainLogger.error('An unexpected error occurred during task execution:', error.message);

			if (error.context && error.context.results) {
				allLanguageStats.push(...error.context.results.filter((r) => !allLanguageStats.find((ar) => ar.language === r.language)));
			}
		} finally {
			await this._printResults(allLanguageStats);

			exitCode = this._determineExitCode(allLanguageStats);
		}

		return exitCode;
	}

	/**
	 * Initializes the AI provider using the ProviderFactory.
	 * Validates configuration and creates the appropriate provider instance.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @throws {Error} If provider creation or validation fails.
	 */
	async _initializeProvider() {
		try {
			this.provider = await ProviderFactory.createAndValidateProvider(this.config, this.mainLogger);

			if (this.config.dryRun) {
				this.mainLogger.info('Dry run mode: provider initialized for cost estimation');
				return;
			}

			this.mainLogger.info(`${this.config.provider} provider initialized`);
		} catch (error) {
			throw new Error(`Failed to initialize provider: ${error.message}`);
		}
	}

	/**
	 * Processes languages sequentially when a global string limit is set.
	 * Uses Listr with concurrency=1 to maintain the same UI/UX as concurrent processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @return {Promise<number>} Exit code (0 for success, 1 for failure).
	 */
	async _processLanguagesSequentially() {
		const allLanguageStats = [];
		const skippedLanguages = [];
		const globalLimit = this.config.maxStringsTotal;
		let totalStringsProcessed = 0;

		this.mainLogger.info('Starting sequential processing…');

		const sequentialTasks = this._createSequentialTasks(globalLimit);
		const listr = this._createSequentialListr(sequentialTasks);
		let exitCode = 1;

		try {
			const context = await listr.run();

			if (context && context.results) {
				allLanguageStats.push(...context.results);

				totalStringsProcessed = context.totalStringsProcessed || 0;
			}

			if (context && context.skippedLanguages) {
				skippedLanguages.push(...context.skippedLanguages);
			}

			this._logStringLimitedCompletion(totalStringsProcessed, globalLimit, skippedLanguages);
		} catch (error) {
			this.mainLogger.error('An unexpected error occurred during sequential task execution:', error.message);

			if (error.context && error.context.results) {
				allLanguageStats.push(...error.context.results.filter((r) => !allLanguageStats.find((ar) => ar.language === r.language)));
			}
		} finally {
			await this._printResults(allLanguageStats);

			exitCode = this._determineExitCode(allLanguageStats);
		}

		return exitCode;
	}

	/**
	 * Creates sequential task definitions for global string limit processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {number} globalLimit - Global string limit.
	 *
	 * @return {Array} Array of sequential task objects.
	 */
	_createSequentialTasks(globalLimit) {
		const sequentialTasks = [];

		for (let i = 0; i < this.config.targetLanguages.length; i++) {
			const language = this.config.targetLanguages[i];

			sequentialTasks.push({
				title: `Queued translation for ${language}`,
				task: async (ctx, task) => {
					const currentTotalProcessed = ctx.totalStringsProcessed || 0;
					const remainingStrings = globalLimit - currentTotalProcessed;

					if (remainingStrings <= 0) {
						this._handleSkippedLanguage(ctx, language, globalLimit, task);
						return;
					}

					await this._processSequentialLanguage(language, i, remainingStrings, ctx, task);
				},
			});
		}

		return sequentialTasks;
	}

	/**
	 * Handles a language that needs to be skipped due to global limit.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} ctx - Task context.
	 * @param {string} language - Language code.
	 * @param {number} globalLimit - Global string limit.
	 * @param {Object} task - Task object.
	 */
	_handleSkippedLanguage(ctx, language, globalLimit, task) {
		ctx.skippedLanguages = ctx.skippedLanguages || [];

		if (!ctx.skippedLanguages.includes(language)) {
			ctx.skippedLanguages.push(language);
		}

		task.title = `Skipped ${language}: Global limit of ${formatNumber(globalLimit)} strings reached`;
		task.skip(`Skipped ${language} - Global limit reached (${formatNumber(globalLimit)} strings)`);
	}

	/**
	 * Processes a single language in sequential mode with global string limit tracking.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Language code to process.
	 * @param {number} index - Language index in the processing order.
	 * @param {number} remainingStrings - Number of strings remaining in global limit.
	 * @param {Object} ctx - Task context for sharing state.
	 * @param {Object} task - Task object for updating progress.
	 *
	 * @return {Promise<Object>} Language processing statistics.
	 */
	async _processSequentialLanguage(language, index, remainingStrings, ctx, task) {
		const startTime = Date.now();

		try {
			const languageLogger = this.logCollector.addLanguageLogger(language);

			// Override maxStrings for this language to respect global limit.
			const languageConfig = {
				...this.config,
				maxStrings: Math.min(this.config.maxStrings || Infinity, remainingStrings),
			};

			// If there's also a cost limit, calculate remaining budget and pass it.
			if (this.config.maxCost) {
				const totalCostSoFar = (ctx.results || []).reduce((sum, stat) => sum + (stat.costData?.totalCost || 0), 0);
				const remainingBudget = this.config.maxCost - totalCostSoFar;

				// Use a smarter threshold for small budgets.
				// For budgets < $0.001, use a smaller absolute threshold
				// For larger budgets, use the original threshold.
				const costThreshold = this.config.maxCost < 0.001 ? 0.00002 : 0.0001;

				if (remainingBudget <= costThreshold) {
					// Cost limit reached, create stats entry for this language
					const costLimitedStats = {
						language,
						totalStringsInPot: 0,
						mergedFromExisting: 0,
						translatedInRun: 0,
						failedInRun: 0,
						skippedDueToBudget: 0,
						skippedDueToLimits: 0,
						alreadyTranslated: 0,
						method: 'cost_limited',
						outputFile: this._getOutputFilePath(language),
						costData: { totalCost: 0, totalTokens: 0 },
						error: null,
						executionTimeMs: 0,
					};

					ctx.results = ctx.results || [];
					ctx.results.push(costLimitedStats);

					ctx.skippedLanguages = ctx.skippedLanguages || [];
					if (!ctx.skippedLanguages.includes(language)) {
						ctx.skippedLanguages.push(language);
					}
					task.title = `Skipped ${language}: Cost limit of $${this.config.maxCost.toFixed(4)} reached`;
					task.skip(`Skipped ${language} - Cost limit reached ($${this.config.maxCost.toFixed(4)})`);
					return;
				}

				languageConfig.maxCostRemaining = remainingBudget;
			}

			const processor = new LanguageProcessor(languageConfig, this.provider, languageLogger);

			const stats = await processor.processLanguage(language, (progressText) => {
				task.title = progressText;
			});

			const endTime = Date.now();
			const executionTimeMs = endTime - startTime;

			// Add execution time to stats.
			stats.executionTimeMs = executionTimeMs;

			ctx.results = ctx.results || [];
			ctx.results.push(stats);

			// Update global tracking.
			const stringsProcessed = stats.translatedInRun || 0;

			ctx.totalStringsProcessed = (ctx.totalStringsProcessed || 0) + stringsProcessed;

			this._updateSequentialTaskTitle(task, language, stats);
			this._logValidationWarnings(language, stats);

			return stats;
		} catch (error) {
			const endTime = Date.now();
			const executionTimeMs = endTime - startTime;

			this._handleSequentialTaskError(ctx, language, error, task, executionTimeMs);
			throw error;
		}
	}

	/**
	 * Updates the task title for a completed sequential language task.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} task - Task object.
	 * @param {string} language - Language code.
	 * @param {Object} stats - Language processing statistics.
	 */
	_updateSequentialTaskTitle(task, language, stats) {
		// Use the shared buildLanguageResultLine function for consistent formatting.
		const line = buildLanguageResultLine(stats, {
			includeLanguageCode: true,
			styled: false,
			prefix: 'Finished',
		});

		task.title = line;
	}

	/**
	 * Handles errors during sequential language processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} ctx - Task context.
	 * @param {string} language - Language code.
	 * @param {Error} error - Error that occurred.
	 * @param {Object} task - Task object.
	 * @param {number} executionTimeMs - Execution time in milliseconds.
	 */
	_handleSequentialTaskError(ctx, language, error, task, executionTimeMs = 0) {
		task.title = `Error processing ${language}: ${error.message.substring(0, 100)}…`;

		ctx.results = ctx.results || [];
		ctx.results.push({
			language,
			error: error.message,
			logs: this.logCollector.getLogsFor(language),
			outputFile: path.join(this.config.outputDir, `${this.config.poFilePrefix}${getFileNamingLocale(language, this.config.localeFormat)}.po`),
			translatedInRun: 0,
			failedInRun: 0,
			executionTimeMs,
		});
	}

	/**
	 * Creates a Listr instance for sequential processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} sequentialTasks - Array of sequential task definitions.
	 *
	 * @return {Listr} Configured Listr instance.
	 */
	_createSequentialListr(sequentialTasks) {
		return new Listr(sequentialTasks, {
			concurrent: 1,
			exitOnError: false,
			renderer: this._getListrRenderer(),
			rendererOptions: {
				showTimer: this.config.verboseLevel >= 1,
				collapseErrors: false,
				formatOutput: 'wrap',
			},
		});
	}

	/**
	 * Logs completion message for sequential processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {number} totalStringsProcessed - Total strings processed.
	 * @param {number} globalLimit - Global string limit.
	 * @param {Array} skippedLanguages - Array of skipped language codes.
	 */
	_logStringLimitedCompletion(totalStringsProcessed, globalLimit, skippedLanguages) {
		// Don't log completion message when outputting JSON to stdout to keep output clean.
		if (this.config.outputFormat === 'json' && !this.config.outputFile) {
			return;
		}

		let completionMessage = `Sequential processing completed. Total strings processed: ${formatNumber(totalStringsProcessed)}/${formatNumber(globalLimit)}`;

		if (skippedLanguages.length > 0) {
			completionMessage += `. Skipped ${formatCount(skippedLanguages.length, 'language')} due to global limit: ${skippedLanguages.join(', ')}`;
		}

		this.mainLogger.success(completionMessage);
	}

	/**
	 * Processes languages sequentially when a cost limit is set.
	 * Tracks total cost across all languages and stops when limit is reached.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @return {Promise<number>} Exit code (0 for success, 1 for failure).
	 */
	async _processLanguagesWithCostLimit() {
		const allLanguageStats = [];
		let totalCostAccumulated = 0;

		this.mainLogger.info('Starting sequential processing…');

		for (let i = 0; i < this.config.targetLanguages.length; i++) {
			const language = this.config.targetLanguages[i];
			const remainingBudget = this.config.maxCost - totalCostAccumulated;

			// Use a smarter threshold for small budgets.
			// For budgets < $0.001, use a smaller absolute threshold
			// For larger budgets, use the original threshold.
			const costThreshold = this.config.maxCost < 0.001 ? 0.00002 : 0.0001;

			if (remainingBudget <= costThreshold) {
				// Create stats entries for skipped languages due to cost limit.
				for (let j = i; j < this.config.targetLanguages.length; j++) {
					const skippedLanguage = this.config.targetLanguages[j];
					const skippedStats = {
						language: skippedLanguage,
						totalStringsInPot: 0,
						mergedFromExisting: 0,
						translatedInRun: 0,
						failedInRun: 0,
						skippedDueToBudget: 0,
						skippedDueToLimits: 0,
						alreadyTranslated: 0,
						method: 'cost_limited',
						outputFile: this._getOutputFilePath(skippedLanguage),
						costData: { totalCost: 0, totalTokens: 0 },
						error: null,
						executionTimeMs: 0,
					};
					allLanguageStats.push(skippedStats);
				}

				this._handleCostLimitReached(i);
				break;
			}

			this.mainLogger.info(`Processing ${language} (${i + 1}/${this.config.targetLanguages.length}) - $${remainingBudget.toFixed(4)} remaining in budget`);

			try {
				const stats = await this._processCostLimitedLanguage(language, remainingBudget);

				allLanguageStats.push(stats);

				const languageCost = stats.costData?.totalCost || 0;

				totalCostAccumulated += languageCost;

				this._logCostLimitedLanguageResult(language, stats, languageCost, totalCostAccumulated);

				if (this._shouldStopDueToCostLimit(totalCostAccumulated, i)) {
					// Create stats entries for remaining skipped languages.
					for (let j = i + 1; j < this.config.targetLanguages.length; j++) {
						const skippedLanguage = this.config.targetLanguages[j];
						const skippedStats = {
							language: skippedLanguage,
							totalStringsInPot: 0,
							mergedFromExisting: 0,
							translatedInRun: 0,
							failedInRun: 0,
							skippedDueToBudget: 0,
							skippedDueToLimits: 0,
							alreadyTranslated: 0,
							method: 'cost_limited',
							outputFile: this._getOutputFilePath(skippedLanguage),
							costData: { totalCost: 0, totalTokens: 0 },
							error: null,
							executionTimeMs: 0,
						};
						allLanguageStats.push(skippedStats);
					}
					break;
				}
			} catch (error) {
				this._handleCostLimitedLanguageError(language, error, allLanguageStats);
			}
		}

		this._logCostLimitedCompletion(totalCostAccumulated);

		await this._printResults(allLanguageStats);

		return this._determineExitCode(allLanguageStats);
	}

	/**
	 * Handles when the cost limit is reached.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {number} currentIndex - Current language index.
	 */
	_handleCostLimitReached(currentIndex) {
		this.mainLogger.info(`Cost limit of $${this.config.maxCost.toFixed(4)} reached. Skipping remaining languages: ${this.config.targetLanguages.slice(currentIndex).join(', ')}`);
	}

	/**
	 * Processes a single language with cost limit tracking.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Language code to process.
	 * @param {number} remainingBudget - Remaining cost budget.
	 *
	 * @return {Promise<Object>} Language processing statistics.
	 */
	async _processCostLimitedLanguage(language, remainingBudget) {
		const startTime = Date.now();

		try {
			const languageLogger = this.logCollector.addLanguageLogger(language);

			// Create a copy of the config with the remaining budget set for this language.
			const configWithBudget = { ...this.config, maxCostRemaining: remainingBudget };
			const processor = new LanguageProcessor(configWithBudget, this.provider, languageLogger);

			const stats = await processor.processLanguage(language, (progressText) => {
				this.mainLogger.info(progressText);
			});

			const endTime = Date.now();
			const executionTimeMs = endTime - startTime;

			// Add execution time to stats.
			stats.executionTimeMs = executionTimeMs;

			return stats;
		} catch (error) {
			const endTime = Date.now();
			const executionTimeMs = endTime - startTime;

			// Create error stats with execution time.
			return {
				language,
				error: error.message,
				logs: this.logCollector.getLogsFor(language),
				outputFile: path.join(this.config.outputDir, `${this.config.poFilePrefix}${getFileNamingLocale(language, this.config.localeFormat)}.po`),
				translatedInRun: 0,
				failedInRun: 0,
				executionTimeMs,
			};
		}
	}

	/**
	 * Logs the result of processing a cost-limited language.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Language code.
	 * @param {Object} stats - Language processing statistics.
	 * @param {number} languageCost - Cost for this language.
	 * @param {number} totalCostAccumulated - Total accumulated cost.
	 */
	_logCostLimitedLanguageResult(language, stats, languageCost, totalCostAccumulated) {
		const costDisplay = this.config.dryRun ? 'Cost (estimated)' : 'Cost';
		const resultParts = buildResultParts(stats);

		this.mainLogger.info(`✔ Finished ${language}: ${resultParts.join(', ')}. ${costDisplay}: $${languageCost.toFixed(4)}. Total ${this.config.dryRun ? 'estimated ' : ''}cost: $${totalCostAccumulated.toFixed(4)}/$${this.config.maxCost.toFixed(4)}`);

		this._logValidationWarnings(language, stats);

		if (stats.skippedDueToBudget > 0 && languageCost === 0) {
			const remainingBudget = this.config.maxCost - totalCostAccumulated;

			this.mainLogger.info(`💰 ${language}: ${formatNumber(stats.skippedDueToBudget)} strings skipped due to budget limit (remaining: $${remainingBudget.toFixed(4)})`);
		}
	}

	/**
	 * Determines if processing should stop due to cost limit.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {number} totalCostAccumulated - Total accumulated cost.
	 * @param {number} currentIndex - Current language index.
	 *
	 * @return {boolean} True if processing should stop.
	 */
	_shouldStopDueToCostLimit(totalCostAccumulated, currentIndex) {
		if (totalCostAccumulated < this.config.maxCost * 0.95) {
			return false;
		}

		const limitType = this.config.dryRun ? 'estimated cost limit' : 'cost limit';
		const roundedTotalCost = parseFloat(totalCostAccumulated.toFixed(4));
		const roundedMaxCost = parseFloat(this.config.maxCost.toFixed(4));
		const percentage = ((roundedTotalCost / roundedMaxCost) * 100).toFixed(1);

		this.mainLogger.info(`Approaching ${limitType} (${percentage}% used). ${this.config.dryRun ? 'Would stop' : 'Stopping'} to avoid budget overrun.`);

		if (currentIndex + 1 < this.config.targetLanguages.length) {
			const skipMessage = this.config.dryRun ? 'Would skip' : 'Skipping';

			this.mainLogger.info(`${skipMessage} remaining languages: ${this.config.targetLanguages.slice(currentIndex + 1).join(', ')}`);
		}

		return true;
	}

	/**
	 * Handles errors during cost-limited language processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Language code.
	 * @param {Error} error - Error that occurred.
	 * @param {Array} allLanguageStats - Array to add error stats to.
	 */
	_handleCostLimitedLanguageError(language, error, allLanguageStats) {
		this.mainLogger.error(`Error processing ${language}: ${error.message}`);

		allLanguageStats.push({
			language,
			error: error.message,
			logs: this.logCollector.getLogsFor(language),
			outputFile: path.join(this.config.outputDir, `${this.config.poFilePrefix}${getFileNamingLocale(language, this.config.localeFormat)}.po`),
			translatedInRun: 0,
			failedInRun: 0,
			costData: { totalCost: 0, totalTokens: 0 },
		});
	}

	/**
	 * Logs completion message for cost-limited processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {number} totalCostAccumulated - Total accumulated cost.
	 */
	_logCostLimitedCompletion(totalCostAccumulated) {
		// Don't log completion message when outputting JSON to stdout to keep output clean.
		if (this.config.outputFormat === 'json' && !this.config.outputFile) {
			return;
		}

		const roundedTotalCost = parseFloat(totalCostAccumulated.toFixed(4));
		const roundedMaxCost = parseFloat(this.config.maxCost.toFixed(4));
		const percentage = ((roundedTotalCost / roundedMaxCost) * 100).toFixed(1);

		this.mainLogger.success(`Cost-limited processing completed. Total ${this.config.dryRun ? 'estimated ' : ''}cost: $${roundedTotalCost.toFixed(4)}/$${roundedMaxCost.toFixed(4)} (${percentage}% of budget ${this.config.dryRun ? 'would be ' : ''}used)`);
	}

	/**
	 * Creates task definitions for processing each target language.
	 * Each task handles language processing, error handling, and result collection.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @return {Array} Array of task definitions for Listr.
	 */
	_createLanguageTasks() {
		return this.config.targetLanguages.map((language) => ({
			title: `Queued translation for ${language}`,
			task: async (ctx, task) => {
				const startTime = Date.now();

				this.mainLogger.info(`Processing ${language}…`);

				try {
					const languageLogger = this.logCollector.addLanguageLogger(language);
					const processor = new LanguageProcessor(this.config, this.provider, languageLogger);

					const stats = await processor.processLanguage(language, (progressText) => {
						task.title = progressText;
					});

					const endTime = Date.now();
					const executionTimeMs = endTime - startTime;

					// Add execution time to stats.
					stats.executionTimeMs = executionTimeMs;

					ctx.results = ctx.results || [];
					ctx.results.push(stats);

					this._updateTaskTitle(task, language, stats);
					this._logValidationWarnings(language, stats);
				} catch (error) {
					const endTime = Date.now();
					const executionTimeMs = endTime - startTime;

					this._handleTaskError(ctx, language, error, task, executionTimeMs);
					throw error;
				}
			},
		}));
	}

	/**
	 * Updates the task title for a completed language task.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} task - Task object.
	 * @param {string} language - Language code.
	 * @param {Object} stats - Language processing statistics.
	 */
	_updateTaskTitle(task, language, stats) {
		// Use the shared buildLanguageResultLine function for consistent formatting.
		const line = buildLanguageResultLine(stats, {
			includeLanguageCode: true,
			styled: false,
			prefix: 'Finished',
		});

		task.title = line;
	}

	/**
	 * Logs validation warnings to the main logger if any validation issues were detected.
	 *
	 * @private
	 *
	 * @since TBD
	 *
	 * @param {string} language - Language code.
	 * @param {Object} stats - Language processing statistics.
	 */
	_logValidationWarnings(language, stats) {
		// Check if validation stats exist and verbosity level is at least 1.
		if (!stats.validationStats || (this.config.verboseLevel || 1) < 1) {
			return;
		}

		const totalValidationIssues = getTotalValidationIssues(stats.validationStats);

		if (totalValidationIssues > 0) {
			const breakdown = formatValidationBreakdown(stats.validationStats);
			this.mainLogger.warn(`⚠️  ${language}: ${breakdown}. Run with -v 2 for details.`);
		}
	}

	/**
	 * Handles errors during language task processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} ctx - Task context.
	 * @param {string} language - Language code.
	 * @param {Error} error - Error that occurred.
	 * @param {Object} task - Task object.
	 * @param {number} executionTimeMs - Execution time in milliseconds.
	 */
	_handleTaskError(ctx, language, error, task, executionTimeMs = 0) {
		task.title = `Error processing ${language}: ${error.message.substring(0, 100)}…`;

		ctx.results = ctx.results || [];
		ctx.results.push({
			language,
			error: error.message,
			logs: this.logCollector.getLogsFor(language),
			outputFile: path.join(this.config.outputDir, `${this.config.poFilePrefix}${getFileNamingLocale(language, this.config.localeFormat)}.po`),
			translatedInRun: 0,
			failedInRun: 0,
			executionTimeMs,
		});
	}

	/**
	 * Creates and configures a Listr instance for running language tasks.
	 * Sets up parallelism, error handling, and rendering options.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} tasks - Array of task definitions.
	 *
	 * @return {Listr} Configured Listr instance.
	 */
	_createListr(tasks) {
		return new Listr(tasks, {
			concurrent: this.config.concurrentJobs,
			exitOnError: false, // Continue other languages if one fails.
			renderer: this._getListrRenderer(),
			rendererOptions: {
				showTimer: this.config.verboseLevel >= 1,
				collapseErrors: false,
				formatOutput: 'wrap',
			},
		});
	}

	/**
	 * Determines the appropriate Listr renderer based on verbosity level and TTY availability.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @return {string} Renderer name ('verbose', 'simple', or 'silent').
	 */
	_getListrRenderer() {
		if (this.config.outputFormat === 'json' && !this.config.outputFile) {
			return 'silent';
		}

		if (this.config.verboseLevel === 0) {
			return 'silent';
		}

		if (this.config.verboseLevel >= 2) {
			return 'verbose';
		}

		return !process.stdout.isTTY ? 'verbose' : 'default';
	}

	/**
	 * Reports translation results using the configured output format.
	 * Uses the Reporter pattern to handle different output formats (console, JSON, etc.).
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} allLanguageStats - Array of language processing results.
	 *
	 * @return {Promise<void>} Resolves when all reports are printed.
	 */
	async _printResults(allLanguageStats) {
		try {
			const reporter = ReporterFactory.createAndValidateReporter(this.config, this.mainLogger);
			const endTime = Date.now();

			await reporter.report(allLanguageStats, this.startTime, endTime, this.logCollector);
		} catch (error) {
			this.mainLogger.error(`Failed to generate report: ${error.message}`);

			if (allLanguageStats.length === 0) {
				this.mainLogger.warn('No language tasks were processed or no statistics were collected.');
				return;
			}

			this.mainLogger.warn('Using fallback console output due to reporter error.');

			const endTime = Date.now();

			printTranslationRunSummary(allLanguageStats, this.mainLogger, defaultChalk, this.startTime, endTime);
		}
	}

	/**
	 * Determines the appropriate exit code based on processing results.
	 * Returns 0 if all languages processed successfully, 1 if any had errors.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} allLanguageStats - Array of language processing statistics.
	 *
	 * @return {number} Exit code (0 for success, 1 for failure).
	 */
	_determineExitCode(allLanguageStats) {
		if (allLanguageStats.length === 0) {
			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.error('Script finished, but no languages were attempted or an early critical error occurred.');
			}

			return 1;
		}

		const criticalErrors = allLanguageStats.filter((stat) => stat.error);

		if (criticalErrors.length > 0) {
			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.error(`${formatCount(criticalErrors.length, 'language')} failed to process due to critical errors.`);
			}

			return 1;
		}

		const languagesWithFailures = allLanguageStats.filter((stat) => !stat.error && stat.failedInRun > 0 && stat.translatedInRun === 0);

		if (languagesWithFailures.length > 0) {
			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.warn(`${formatCount(languagesWithFailures.length, 'language')} completed processing but had no successful translations.`);
			}

			return 1;
		}

		const totalTranslated = allLanguageStats.reduce((sum, stat) => sum + (stat.translatedInRun || 0), 0);
		const totalFailed = allLanguageStats.reduce((sum, stat) => sum + (stat.failedInRun || 0), 0);

		// Check if all languages were cost-limited (no translations due to budget constraints.)
		const costLimitedLanguages = allLanguageStats.filter((stat) => stat.method === 'cost_limited' || (stat.translatedInRun === 0 && stat.failedInRun === 0 && !stat.error));
		const allLanguagesCostLimited = costLimitedLanguages.length === allLanguageStats.length;

		if (totalTranslated === 0 && totalFailed > 0) {
			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.warn('Processing completed but no strings were successfully translated.');
			}

			return 1;
		}

		// If all languages were cost-limited, consider it successful completion.
		if (totalTranslated === 0 && totalFailed === 0 && allLanguagesCostLimited) {
			if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
				this.mainLogger.success('All specified languages processed successfully (cost limits enforced).');
			}

			return 0;
		}

		if (!(this.config.outputFormat === 'json' && !this.config.outputFile)) {
			this.mainLogger.success('All specified languages processed successfully.');
		}

		return 0;
	}

	/**
	 * Generates the output file path for a given language.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Language code.
	 *
	 * @return {string} Output file path.
	 */
	_getOutputFilePath(language) {
		const fileLocale = getFileNamingLocale(language, this.config.localeFormat);

		return path.join(this.config.outputDir, `${this.config.poFilePrefix}${fileLocale}.po`);
	}
}

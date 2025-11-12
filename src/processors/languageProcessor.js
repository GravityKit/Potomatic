import fs from 'fs';
import path from 'path';
import { prepareBatches } from './batchProcessor.js';
import { parsePotFile, countUntranslatedStrings, mergePoData, compilePoFile, initializePluralForms, getPluralForms, extractPluralCount, countRealTranslations } from '../utils/poFileUtils.js';
import { createCostAccumulator } from '../utils/costTracker.js';
import { buildSystemPrompt, getPromptTokenCount } from '../utils/promptLoader.js';
import { formatCost, formatNumber, formatDuration } from '../utils/costCalculations.js';
import { getFileNamingLocale, normalizeLanguageInput, getLanguageName } from '../utils/languageMapping.js';
import { buildXmlPrompt, buildDictionaryResponse } from '../utils/xmlTranslation.js';
import { loadDictionary, findDictionaryMatches } from '../utils/dictionaryUtils.js';
import { createEmptyValidationStats, accumulateValidationStats, getTotalValidationIssues } from '../utils/validationStats.js';

// Cost threshold for determining when to show budget-related skip messages.
// When cost reaches 80% of remaining budget, we show explanatory messages.
const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * Handles the complete translation workflow for a single language.
 * Manages POT parsing, existing translation merging, batch processing, and PO file compilation.
 *
 * @since 1.0.0
 */
export class LanguageProcessor {
	/**
	 * Creates a new LanguageProcessor instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object}   config   - Configuration object.
	 * @param {Provider} provider - AI provider instance.
	 * @param {Object}   logger   - Logger instance for this language.
	 */
	constructor(config, provider, logger) {
		this.config = config;
		this.provider = provider;
		this.logger = logger;
		this.costAccumulator = createCostAccumulator();
	}

	/**
	 * Processes translation for a single language with complete workflow.
	 * Handles POT parsing, merging, batch translation, and progress tracking.
	 *
	 * @since 1.0.0
	 *
	 * @param {string}        language         - Target language code (e.g., 'fr_FR', 'ja').
	 * @param {Function|null} progressCallback - Optional callback for progress updates.
	 *
	 * @throws {Error} When critical errors occur during processing.
	 *
	 * @return {Object} Statistics object containing translation results and counts.
	 */
	async processLanguage(language, progressCallback = null) {
		const stats = this._initializeStats(language);

		this.stats = stats;

		try {
			this.logger.info(`Processing language: ${language}`);

			const normalizedTarget = normalizeLanguageInput(language);
			const normalizedSource = normalizeLanguageInput(this.config.sourceLanguage);
			const targetBaseCode = normalizedTarget.split(/[_-]/)[0];
			const sourceBaseCode = normalizedSource.split(/[_-]/)[0];

			if (targetBaseCode === sourceBaseCode) {
				return await this._processSameLanguage(language, stats);
			}

			const outputFile = this._getOutputFilePath(language);

			stats.outputFile = outputFile;

			this.logger.info(`Output .po file will be: ${outputFile}`);

			const potData = await this._loadPotFile();

			this.potData = potData;
			stats.totalStringsInPot = countUntranslatedStrings(potData);

			const { outputPoData, mergedStringsCount } = await this._mergeExistingTranslations(potData, language);

			this.outputPoData = outputPoData;
			stats.mergedFromExisting = mergedStringsCount;

			const batches = await this._prepareBatches(outputPoData);
			const totalStringsToTranslate = batches.reduce((sum, batch) => sum + batch.length, 0);

			stats.alreadyTranslated = countRealTranslations(outputPoData);

			const totalUntranslatedStrings = countUntranslatedStrings(outputPoData);

			stats.skippedDueToLimits = Math.max(0, totalUntranslatedStrings - totalStringsToTranslate);

			if (totalStringsToTranslate === 0) {
				this.logger.info(`No strings to translate for ${language}. Saving existing/merged .po file.`);

				await this._savePoFile(outputPoData, language, outputFile);

				return stats;
			}

			const { successCount, failedCount, skippedDueToBudget, validationStats } = await this._processBatches(batches, outputPoData, language, outputFile, progressCallback);

			stats.translatedInRun = successCount;
			stats.failedInRun = failedCount;
			stats.skippedDueToBudget = skippedDueToBudget;

			this.logger.success(`All batches for ${language} processed successfully.`);

			stats.costData = this.costAccumulator.getTotals();
			stats.validationStats = validationStats;

			return stats;
		} catch (error) {
			this.logger.error(`Critical error processing ${language}: ${error.message}`);
			stats.error = error.message;

			throw error;
		}
	}

	/**
	 * Initializes the statistics object for language processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code.
	 *
	 * @return {Object} Initialized statistics object.
	 */
	_initializeStats(language) {
		return {
			language,
			totalStringsInPot: 0,
			mergedFromExisting: 0,
			translatedInRun: 0,
			failedInRun: 0,
			skippedDueToBudget: 0,
			skippedDueToLimits: 0,
			alreadyTranslated: 0,
			method: 'api_translation',
			outputFile: null,
			costData: null,
			error: null,
			validationStats: createEmptyValidationStats(),
		};
	}

	/**
	 * Processes same-language translation by copying source strings directly.
	 * Used when target language matches source language to avoid unnecessary API calls.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code (same as source).
	 * @param {Object} stats - Statistics object to populate.
	 *
	 * @return {Promise<Object>} Updated statistics object.
	 */
	async _processSameLanguage(language, stats) {
		this.logger.info(`Target language '${language}' matches source language '${this.config.sourceLanguage}' - copying strings directly`);

		const outputFile = this._getOutputFilePath(language);

		stats.outputFile = outputFile;

		const potData = await this._loadPotFile();

		stats.totalStringsInPot = countUntranslatedStrings(potData);

		const outputPoData = JSON.parse(JSON.stringify(potData));
		const copiedCount = this._copySourceStringsToTarget(outputPoData);

		await this._savePoFile(outputPoData, language, outputFile);

		stats.translatedInRun = copiedCount;
		stats.mergedFromExisting = 0;
		stats.failedInRun = 0;
		stats.method = 'source_copy';

		const formattedCount = formatNumber(copiedCount);

		this.logger.success(`Copied ${formattedCount} strings from source language to ${language}.po`);

		return stats;
	}

	/**
	 * Copies source strings to target strings for same-language processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} outputPoData - PO data structure to modify.
	 *
	 * @return {number} Number of strings copied.
	 */
	_copySourceStringsToTarget(outputPoData) {
		let copiedCount = 0;

		for (const [, contextData] of Object.entries(outputPoData.translations)) {
			for (const [msgid, translation] of Object.entries(contextData)) {
				if (!msgid || msgid === '') {
					continue;
				}

				if (translation.msgstr && Array.isArray(translation.msgstr)) {
					translation.msgstr = [msgid];
				} else {
					translation.msgstr = msgid;
				}
				copiedCount++;
			}
		}

		return copiedCount;
	}

	/**
	 * Generates the output file path for a given language.
	 * Combines configured prefix, language code, and output directory.
	 * Uses the configured locale format for file naming.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code.
	 *
	 * @return {string} Full path to output .po file.
	 */
	_getOutputFilePath(language) {
		const fileNamingLocale = getFileNamingLocale(language, this.config.localeFormat);
		const fileName = `${this.config.poFilePrefix}${fileNamingLocale}.po`;

		return path.join(this.config.outputDir, fileName);
	}

	/**
	 * Loads and parses the POT file specified in configuration.
	 * Validates file existence and POT data structure before returning.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @throws {Error} If POT file cannot be loaded or parsed.
	 *
	 * @return {Promise<Object>} Parsed POT data structure.
	 */
	async _loadPotFile() {
		try {
			const potData = await parsePotFile(this.config.potFilePath, this.logger);

			if (!potData || !potData.translations) {
				throw new Error(`Parsed .pot file is empty or invalid: ${this.config.potFilePath}`);
			}

			return potData;
		} catch (error) {
			this.logger.error(`Could not load or parse POT file ${this.config.potFilePath}. Error: ${error.message}`);

			throw error;
		}
	}

	/**
	 * Merges existing translations with POT data to preserve completed work.
	 * Handles force translate mode and missing existing files gracefully.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} potData - Parsed POT data structure.
	 * @param {string} language - Target language code.
	 *
	 * @return {Promise<Object>} Object containing outputPoData and mergedStringsCount.
	 */
	async _mergeExistingTranslations(potData, language) {
		// Initialize plural forms for the target language.
		let outputPoData = initializePluralForms(potData, language, this.logger);
		let mergedStringsCount = 0;

		if (this.config.forceTranslate) {
			this.logger.info(`Force translate enabled for ${language}: Starting with a clean slate from the .pot file.`);

			return { outputPoData, mergedStringsCount };
		}

		// Check for specific input PO path first, then conventional output path
		let existingPoPath = null;

		if (this.config.inputPoPath && fs.existsSync(this.config.inputPoPath)) {
			existingPoPath = this.config.inputPoPath;

			this.logger.info(`Using specific input .po file: ${existingPoPath}`);
		} else {
			const outputFile = this._getOutputFilePath(language);

			if (fs.existsSync(outputFile)) {
				existingPoPath = outputFile;
				this.logger.info(`Found existing .po file at conventional path: ${existingPoPath}`);
			}
		}

		if (!existingPoPath) {
			this.logger.info(`No existing .po file found for ${language}. Starting fresh translation.`);

			return { outputPoData, mergedStringsCount };
		}

		try {
			this.logger.info(`Attempting to merge translations from: ${existingPoPath}`);

			const existingPoData = await parsePotFile(existingPoPath, this.logger);

			if (existingPoData) {
				const mergeResult = mergePoData(outputPoData, existingPoData, this.logger, language);

				outputPoData = mergeResult.outputPoData;
				mergedStringsCount = mergeResult.mergedStringsCount;

				this.logger.info(`Merge complete. ${formatNumber(mergedStringsCount)} strings were merged.`);
			}
		} catch (error) {
			this.logger.warn(`Could not parse existing .po file ${existingPoPath}. Proceeding without merging. Error: ${error.message}`);
		}

		return { outputPoData, mergedStringsCount };
	}

	/**
	 * Prepares translation batches from PO data.
	 * Delegates to the batch processor with configured batch size and string limits.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} outputPoData - PO data structure to prepare batches from.
	 *
	 * @return {Promise<Array>} Array of batches ready for translation.
	 */
	async _prepareBatches(outputPoData) {
		return prepareBatches(outputPoData, this.config.batchSize, this.logger, this.config.maxStrings);
	}

	/**
	 * Processes all translation batches sequentially with error handling and progress tracking.
	 * Handles dry run mode, cost tracking, and automatic file saving after each batch.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array}         batches          - Array of translation batches to process.
	 * @param {Object}        outputPoData     - PO data structure to update with translations.
	 * @param {string}        language         - Target language code.
	 * @param {string}        outputFile       - Path to output .po file.
	 * @param {Function|null} progressCallback - Optional callback for progress updates.
	 *
	 * @throws {Error} If critical errors occur during batch processing.
	 *
	 * @return {Promise<Object>} Object containing successCount, failedCount, and skippedDueToBudget.
	 */
	async _processBatches(batches, outputPoData, language, outputFile, progressCallback) {
		const skippedDueToLimitsCount = 0;
		const totalStringsToTranslate = batches.reduce((sum, batch) => sum + batch.length, 0);
		const processStartTime = Date.now();
		let successfullyTranslatedCount = 0;
		let actuallyFailedCount = 0;
		let skippedDueToBudgetCount = 0;
		let processedStringsCount = 0;
		let previousBatchDuration = null;

		// Accumulate validation stats across all batches.
		const accumulatedValidationStats = createEmptyValidationStats();

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			const batchNumber = i + 1;
			const batchStartTime = Date.now();

			this.logger.info(`Processing batch ${batchNumber} of ${batches.length} (${formatNumber(batch.length || 0)} strings)…`);

			this._updateProgressCallback(progressCallback, processedStringsCount, totalStringsToTranslate, language, batchNumber, batches.length, previousBatchDuration, processStartTime, '');

			try {
				let translatedBatchItems;

				if (this.config.dryRun) {
					const dryRunResult = await this._processDryRunBatch(batch, batchNumber, batches.length, language);

					translatedBatchItems = dryRunResult.translatedBatchItems;

					if (this._shouldStopDueToCostLimit(batches, i, skippedDueToBudgetCount, processedStringsCount, language)) {
						const remainingBatches = batches.slice(i + 1);

						skippedDueToBudgetCount = remainingBatches.reduce((sum, batch) => sum + batch.length, 0);

						break;
					}
				} else {
					if (this._shouldStopBeforeBatch(batch, batchNumber, batches, i, skippedDueToBudgetCount, processedStringsCount, language)) {
						const remainingBatches = batches.slice(i);

						skippedDueToBudgetCount = remainingBatches.reduce((sum, batch) => sum + batch.length, 0);

						break;
					}

					const batchResult = await this._processActualBatch(batch, language, batchNumber, batches.length, progressCallback, processedStringsCount, totalStringsToTranslate, processStartTime);

					translatedBatchItems = batchResult.translatedBatchItems;

					if (!batchResult.success) {
						const failureResult = await this._handleBatchFailure(batchResult, batch, batchNumber, batches, i, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount);

						if (failureResult.shouldStop) {
							if (failureResult.shouldThrow) {
								throw new Error(failureResult.errorMessage);
							}

							successfullyTranslatedCount = failureResult.successfullyTranslatedCount;
							actuallyFailedCount = failureResult.actuallyFailedCount;
							processedStringsCount = failureResult.processedStringsCount;
							break;
						}

						if (this.config.stopOnMaxRetriesFailure || this.config.skipJobOnMaxRetriesFailure) {
							successfullyTranslatedCount = failureResult.successfullyTranslatedCount;
							actuallyFailedCount = failureResult.actuallyFailedCount;
							processedStringsCount = failureResult.processedStringsCount;

							continue;
						}
					}

					if (batchResult.cost) {
						this.costAccumulator.addCost(batchResult.cost);

						if (this._shouldStopAfterBatch(batches, i, skippedDueToBudgetCount, processedStringsCount, language)) {
							break;
						}
					}

					// Accumulate validation stats from this batch.
					if (batchResult.validationStats) {
						accumulateValidationStats(accumulatedValidationStats, batchResult.validationStats);

						// Debug: log validation stats.
						this.logger.debug(`Batch ${batchNumber} validation stats:`, JSON.stringify(batchResult.validationStats));
					} else {
						this.logger.debug(`Batch ${batchNumber} has no validationStats`);
					}
				}

				this._updatePoDataWithBatch(outputPoData, translatedBatchItems);

				const { batchSuccessCount, batchFailedCount, errorSummary } = this._countBatchResults(translatedBatchItems);

				successfullyTranslatedCount += batchSuccessCount;
				actuallyFailedCount += batchFailedCount;
				processedStringsCount += batch.length;

				const batchEndTime = Date.now();

				previousBatchDuration = batchEndTime - batchStartTime;

				this.logger.success(`Batch ${batchNumber} processed. Success: ${batchSuccessCount}, Failed: ${batchFailedCount}.`);

				if (batchFailedCount > 0 && errorSummary) {
					this.logger.warn(`Batch ${batchNumber} errors: ${errorSummary}`);
				}

				await this._savePoFile(outputPoData, language, outputFile);

				this.logger.info(`Batch ${batchNumber}/${batches.length} data saved to ${outputFile}.`);
			} catch (error) {
				this.logger.error(`Critical error during translation of batch ${batchNumber}: ${error.message}`);
				throw error;
			}
		}

		this._logFinalSummary(language, successfullyTranslatedCount, batches, skippedDueToBudgetCount, outputFile);

		// Display validation summary at verbosity level 2+ in detailed logs.
		const totalValidationIssues = getTotalValidationIssues(accumulatedValidationStats);

		this.logger.debug(`Total validation issues: ${totalValidationIssues}`, JSON.stringify(accumulatedValidationStats));
		this.logger.debug(`Verbose level: ${this.config.verboseLevel || 1}`);

		if (totalValidationIssues > 0 && (this.config.verboseLevel || 1) >= 2) {
			const breakdown = formatValidationBreakdown(accumulatedValidationStats);

			this.logger.warn(`Validation: ${breakdown}`);
		}

		return {
			successCount: successfullyTranslatedCount,
			failedCount: actuallyFailedCount,
			skippedDueToBudget: skippedDueToBudgetCount,
			skippedDueToLimits: skippedDueToLimitsCount,
			validationStats: accumulatedValidationStats,
		};
	}

	/**
	 * Updates progress callback with current translation status.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Function|null} progressCallback - Optional callback for progress updates.
	 * @param {number} processedStringsCount - Number of strings processed so far.
	 * @param {number} totalStringsToTranslate - Total number of strings to translate.
	 * @param {string} language - Target language code.
	 * @param {number} batchNumber - Current batch number.
	 * @param {number} totalBatches - Total number of batches.
	 * @param {number|null} previousBatchDuration - Duration of previous batch in milliseconds.
	 * @param {number|null} processStartTime - Start time of the entire process in milliseconds.
	 * @param {string} retryStatus - Retry status string to append to the first line.
	 */
	_updateProgressCallback(progressCallback, processedStringsCount, totalStringsToTranslate, language, batchNumber, totalBatches, previousBatchDuration, processStartTime = null, retryStatus = '') {
		if (!progressCallback) return;

		const languageDisplayName = getLanguageName(language);
		const currentCost = this.costAccumulator.getTotals().totalCost;
		const currentTokens = this.costAccumulator.getTotals().totalTokens;

		// Get POT stats - use consistent data source.
		// Show original POT counts (before plural expansion) to avoid user confusion.
		const potStats = this.potData
			? {
					total: this._countAllPotEntries(this.potData),
					merged: this.stats ? this.stats.mergedFromExisting : 0,
					// Calculate untranslated based on original POT count, not expanded plural forms
					untranslated: this._countAllPotEntries(this.potData) - (this.stats ? this.stats.mergedFromExisting : 0),
				}
			: { total: 0, merged: 0, untranslated: 0 };

		// Calculate batch progress.
		const batchSize = this.config.batchSize;
		const currentBatchProgress = Math.min(processedStringsCount, totalStringsToTranslate);
		const progressPercentage = totalStringsToTranslate > 0 ? Math.round((currentBatchProgress / totalStringsToTranslate) * 100) : 0;

		// Format cost display
		const costDisplay = this.config.maxCost ? `$${currentCost.toFixed(6)}/$${this.config.maxCost.toFixed(6)}` : `$${currentCost.toFixed(6)}`;

		// Build limit display - only show when there are actual limits.
		let limitDisplay = '';
		const limits = [];

		if (this.config.maxStrings) {
			limits.push(`${this.config.maxStrings} strings`);
		}
		if (this.config.maxStringsTotal) {
			limits.push(`${this.config.maxStringsTotal} total strings`);
		}
		if (this.config.maxCost) {
			limits.push(`$${this.config.maxCost.toFixed(6)} cost`);
		}

		if (limits.length > 0) {
			limitDisplay = ` | Limit: ${limits.join(', ')}`;
		}

		// Calculate execution time if start time is provided.
		let timeText = '';

		if (processStartTime) {
			const elapsedMs = Date.now() - processStartTime;
			timeText = formatDuration(elapsedMs);
		}

		const batchSizeText = timeText ? `📦 Batch Size: ${batchSize} | Progress: ${currentBatchProgress}/${totalStringsToTranslate} (${progressPercentage}%) | Time: ${timeText}` : `📦 Batch Size: ${batchSize} | Progress: ${currentBatchProgress}/${totalStringsToTranslate} (${progressPercentage}%)`;

		const progressLines = [
			`⠼ Language: ${language} (${languageDisplayName}) | Batch ${batchNumber} of ${totalBatches}${limitDisplay}${retryStatus}`,
			`📊 POT Stats: ${potStats.total} strings, ${potStats.merged} merged, ${potStats.untranslated} strings to translate`,
			batchSizeText,
			`💰 Cost: ${costDisplay} | Tokens: ${formatNumber(currentTokens)}`,
		];

		const progressText = progressLines.join('\n');

		progressCallback(progressText);
	}

	/**
	 * Processes a batch in dry run mode with cost estimation.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Translation batch to process.
	 * @param {number} batchNumber - Current batch number.
	 * @param {number} totalBatches - Total number of batches.
	 * @param {string} language - Target language code.
	 *
	 * @return {Promise<Object>} Object containing translatedBatchItems.
	 */
	async _processDryRunBatch(batch, batchNumber, totalBatches, language) {
		this.logger.info(`[Batch ${batchNumber}/${totalBatches}] DRY RUN: Analyzing ${formatNumber(batch.length || 0)} strings for translation`);

		const systemPrompt = buildSystemPrompt(language, this.config.sourceLanguage, this.config.promptFilePath);
		const costData = this._calculateDryRunCosts(batch, systemPrompt, language);

		// Log dictionary usage if enabled.
		if (this.config.useDictionary && costData.dictionaryInfo.matches > 0) {
			this.logger.info(`Dictionary: ${costData.dictionaryInfo.matches} matching terms found (+${costData.dictionaryInfo.additionalTokens} tokens)`);
		}

		if (this.config.verboseLevel >= 2) {
			// Calculate prompt components to show what would be sent to AI.
			const pluralFormsString = getPluralForms(language, this.logger);
			const pluralCount = extractPluralCount(pluralFormsString);

			// Load dictionary if enabled.
			let dictionaryMatches = [];

			if (this.config.useDictionary) {
				const dictionary = loadDictionary(this.config.dictionaryPath, language, this.logger);

				dictionaryMatches = findDictionaryMatches(batch, dictionary);
			}

			// Build the actual XML prompt that would be sent.
			const promptResult = buildXmlPrompt(batch, language, pluralCount, dictionaryMatches);

			this.logger.info(`=== DRY RUN: SYSTEM MESSAGE ===`);
			this.logger.info(systemPrompt);
			this.logger.info(`=== END SYSTEM MESSAGE ===`);
			this.logger.info(`=== DRY RUN: USER MESSAGE (XML) ===`);
			this.logger.info(promptResult.xmlPrompt);
			this.logger.info(`=== END USER MESSAGE ===`);

			// Show dictionary response if there are matches
			if (dictionaryMatches.length > 0) {
				const dictionaryResponse = buildDictionaryResponse(dictionaryMatches);

				this.logger.info(`=== DRY RUN: DICTIONARY EXAMPLES ===`);
				this.logger.info(dictionaryResponse);
				this.logger.info(`=== END DICTIONARY EXAMPLES ===`);
			}
		}

		this._logDryRunSamples(batch, batchNumber);

		const { estimatedCost, totalEstimatedTokens, inputTokens, estimatedOutputTokens } = costData;

		this.logger.info(`[Batch ${batchNumber}] Estimated tokens: ${formatNumber(totalEstimatedTokens || 0)} (input: ${formatNumber(inputTokens || 0)}, estimated output: ${formatNumber(estimatedOutputTokens || 0)}), Estimated cost: $${formatCost(estimatedCost)}`);

		const translatedBatchItems = batch.map((item) => ({
			...item,
			msgstr: [`[DRY RUN] Would translate: "${item.msgid.substring(0, 50)}${item.msgid.length > 50 ? '…' : ''}"`],
			dryRun: true,
		}));

		const estimatedCostData = {
			totalCost: estimatedCost,
			totalTokens: totalEstimatedTokens,
			inputTokens,
			outputTokens: estimatedOutputTokens,
			model: this.config.model,
			estimated: true,
			isDryRun: true,
		};

		this.costAccumulator.addCost(estimatedCostData);

		return { translatedBatchItems };
	}

	/**
	 * Logs sample strings for dry run batches based on verbosity level.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Translation batch.
	 * @param {number} batchNumber - Current batch number.
	 */
	_logDryRunSamples(batch, batchNumber) {
		if (this.config.verboseLevel >= 2) {
			this.logger.info(`Sample strings from batch ${batchNumber}:`);

			const sampleCount = Math.min(3, batch.length);

			for (let j = 0; j < sampleCount; j++) {
				const item = batch[j];
				const preview = item.msgid.length > 80 ? item.msgid.substring(0, 80) + '…' : item.msgid;

				this.logger.info(`  [${j + 1}] "${preview}"`);
			}

			if (batch.length > sampleCount) {
				this.logger.info(`  … and ${batch.length - sampleCount} more strings`);
			}
		} else if (this.config.verboseLevel >= 1) {
			this.logger.info(`Sample strings: "${batch[0].msgid.substring(0, 60)}${batch[0].msgid.length > 60 ? '…' : ''}"${batch.length > 1 ? ` and ${batch.length - 1} more` : ''}`);
		}
	}

	/**
	 * Calculates estimated costs for dry run batch processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Translation batch.
	 * @param {string} systemPrompt - System prompt for translation.
	 * @param {string} language - Target language code.
	 *
	 * @return {Object} Object containing cost calculations.
	 */
	_calculateDryRunCosts(batch, systemPrompt, language) {
		const systemPromptTokens = getPromptTokenCount(systemPrompt, this.config.model);

		// Calculate plural count for target language
		const pluralFormsString = getPluralForms(language, this.logger);
		const pluralCount = extractPluralCount(pluralFormsString);

		// Load dictionary if enabled to get accurate prompt size.
		let dictionaryMatches = [];

		if (this.config.useDictionary) {
			const dictionary = loadDictionary(this.config.dictionaryPath, language, this.logger);

			dictionaryMatches = findDictionaryMatches(batch, dictionary);
		}

		// Use XML prompt format with dictionary for accurate cost estimation.
		const promptResult = buildXmlPrompt(batch, language, pluralCount, dictionaryMatches);
		const userMessageTokens = getPromptTokenCount(promptResult.xmlPrompt, this.config.model);

		// Account for additional dictionary assistant response and follow-up.
		let dictionaryResponseTokens = 0;

		if (dictionaryMatches.length > 0) {
			const dictionaryResponse = dictionaryMatches.map((match, index) => `<t i="${index + 1}">${match.target}</t>`).join('\n');

			dictionaryResponseTokens = getPromptTokenCount(dictionaryResponse, this.config.model);

			// Add tokens for the follow-up user message
			const followUpTokens = getPromptTokenCount('<!-- Now translate the actual strings -->', this.config.model);

			dictionaryResponseTokens += followUpTokens;
		}

		const inputTokens = systemPromptTokens + userMessageTokens + dictionaryResponseTokens;
		const estimatedOutputTokens = Math.round(userMessageTokens * 1.4);
		const totalEstimatedTokens = inputTokens + estimatedOutputTokens;

		const pricing = this.provider.getModelPricing(this.config.model);
		const inputCost = (inputTokens / 1000) * pricing.prompt;
		const outputCost = (estimatedOutputTokens / 1000) * pricing.completion;
		const estimatedCost = inputCost + outputCost;

		return {
			estimatedCost,
			totalEstimatedTokens,
			inputTokens,
			estimatedOutputTokens,
			dictionaryInfo: {
				matches: dictionaryMatches.length,
				additionalTokens: dictionaryResponseTokens,
			},
		};
	}

	/**
	 * Checks if processing should stop due to cost limit in dry run mode.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {number} skippedDueToBudgetCount - Current count of skipped strings.
	 * @param {number} processedStringsCount - Current count of processed strings.
	 * @param {string} language - Target language code.
	 *
	 * @return {boolean} True if processing should stop.
	 */
	_shouldStopDueToCostLimit(batches, currentIndex, skippedDueToBudgetCount, processedStringsCount, language) {
		if (this.config.maxCostRemaining === undefined || this.config.maxCostRemaining === null || this.costAccumulator.getTotals().totalCost < this.config.maxCostRemaining) {
			return false;
		}

		this.logger.info(`DRY RUN: Estimated cost limit approaching. Estimated cost: ${formatCost(this.costAccumulator.getTotals().totalCost)}, Limit: ${formatCost(this.config.maxCostRemaining)}`);
		this.logger.info(`DRY RUN: Would stop translation for ${language} to avoid exceeding budget.`);

		const remainingBatches = batches.length - (currentIndex + 1);

		if (remainingBatches > 0) {
			const remainingStrings = batches.slice(currentIndex + 1).reduce((sum, batch) => sum + batch.length, 0);

			this.logger.info(`DRY RUN: Would skip ${remainingBatches} remaining batches (${formatNumber(remainingStrings || 0)} strings) due to cost limit.`);
		}

		return true;
	}

	/**
	 * Checks if processing should stop before processing a batch due to cost limits.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Current translation batch.
	 * @param {number} batchNumber - Current batch number.
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {number} skippedDueToBudgetCount - Current count of skipped strings.
	 * @param {number} processedStringsCount - Current count of processed strings.
	 * @param {string} language - Target language code.
	 *
	 * @return {boolean} True if processing should stop.
	 */
	_shouldStopBeforeBatch(batch, batchNumber, batches, currentIndex, skippedDueToBudgetCount, processedStringsCount, language) {
		if (this.config.maxCostRemaining === undefined || this.config.maxCostRemaining === null) {
			return false;
		}

		const currentCost = this.costAccumulator.getTotals().totalCost;
		const limit = this.config.maxCostRemaining;

		// Stop if we've already reached or exceeded the limit.
		if (currentCost >= limit) {
			this.logger.info(`Cost limit reached before batch ${batchNumber}. Current cost: ${formatCost(currentCost)}, Limit: ${formatCost(limit)}`);
			this.logger.info(`Stopping translation for ${language} to avoid exceeding budget.`);

			this._logRemainingBatchesSkipped(batches, currentIndex, language);

			return true;
		}

		// Check if this batch would exceed the limit.
		const estimatedBatchCost = this._estimateBatchCost(batch, language);

		// Use a smarter threshold that works better with small remaining budgets
		// For small budgets (< $.0.001), use a small absolute safety margin
		// For larger budgets, use a percentage-based approach.
		let safetyThreshold;

		if (limit < 0.001) {
			// For small budgets, use a small absolute margin (.e.g., $0.00005).
			safetyThreshold = Math.max(limit - 0.00005, limit * 0.9);
		} else {
			// For larger budgets, use 95% threshold.
			safetyThreshold = limit * 0.95;
		}

		if (currentCost + estimatedBatchCost > safetyThreshold) {
			this.logger.info(`Cost limit would be exceeded by batch ${batchNumber}:`);
			this.logger.info(`  Current cost: ${formatCost(currentCost)}`);
			this.logger.info(`  Estimated batch cost: ${formatCost(estimatedBatchCost)} (${formatNumber(batch.length || 0)} strings)`);
			this.logger.info(`  Total would be: ${formatCost(currentCost + estimatedBatchCost)} (exceeds safety threshold: ${formatCost(safetyThreshold)})`);
			this.logger.info(`  Remaining budget: ${formatCost(limit)}`);
			this.logger.info(`Stopping translation for ${language} to avoid exceeding budget.`);

			this._logRemainingBatchesSkipped(batches, currentIndex, language);

			return true;
		}

		return false;
	}

	/**
	 * Estimates the cost of processing a single batch.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Translation batch.
	 * @param {string} language - Target language code.
	 *
	 * @return {number} Estimated cost for the batch.
	 */
	_estimateBatchCost(batch, language) {
		const systemPrompt = buildSystemPrompt(language, this.config.sourceLanguage, this.config.promptFilePath);
		const costData = this._calculateDryRunCosts(batch, systemPrompt, language);

		return costData.estimatedCost;
	}

	/**
	 * Logs information about remaining batches being skipped.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {string} language - Target language code.
	 */
	_logRemainingBatchesSkipped(batches, currentIndex, language) {
		const remainingBatches = batches.length - currentIndex;
		const remainingStrings = batches.slice(currentIndex).reduce((sum, batch) => sum + batch.length, 0);

		this.logger.info(`Skipping ${remainingBatches} remaining batches (${formatNumber(remainingStrings || 0)} strings) due to cost limit.`);
	}

	/**
	 * Counts successful and failed translations in a batch and categorizes errors.
	 * Provides detailed statistics for batch processing results.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} translatedBatchItems - Array of translated items from batch processing.
	 *
	 * @return {Object} Object containing batchSuccessCount, batchFailedCount, and errorSummary.
	 */
	_countBatchResults(translatedBatchItems) {
		const errorTypes = new Map();
		let batchSuccessCount = 0;
		let batchFailedCount = 0;

		for (const item of translatedBatchItems) {
			// Check if translation was successful (has valid msgstr content.).
			const msgstr = item.msgstr?.[0];
			const msgstrText = typeof msgstr === 'string' ? msgstr : '';

			// Handle dry run as successful.
			if (item.dryRun || (msgstr && msgstrText !== '' && msgstrText.startsWith('[DRY RUN]'))) {
				batchSuccessCount++;

				continue;
			}

			// Handle regular successful translations.
			if (msgstr && msgstrText !== '' && !msgstrText.startsWith('[DRY RUN')) {
				batchSuccessCount++;

				continue;
			}

			// Handle failures.
			batchFailedCount++;

			// Collect error types for summary.
			let errorType = 'Translation failed';

			if (item.error) {
				errorType = item.error;
			}

			errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
		}

		// Create error summary.
		let errorSummary = null;

		if (errorTypes.size > 0) {
			const errorEntries = Array.from(errorTypes.entries());

			errorSummary = errorEntries.map(([error, count]) => `${error} (${count}x)`).join(', ');
		}

		return { batchSuccessCount, batchFailedCount, errorSummary };
	}

	/**
	 * Updates PO data with translated batch items, only applying valid translations.
	 * Ensures failed translations don't overwrite existing data.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} outputPoData - PO data structure to update.
	 * @param {Array} translatedBatchItems - Array of translated items from batch processing.
	 */
	_updatePoDataWithBatch(outputPoData, translatedBatchItems) {
		// Update the outputPoData with only successfully translated batch items.
		for (const item of translatedBatchItems) {
			// Skip if the item doesn't have a valid translation.
			if (!item.msgstr || !item.msgstr[0] || item.msgstr[0] === '') {
				continue;
			}

			// Debug logging to see what we're processing
			this.logger.debug(`Updating item: "${item.msgid}"`);
			this.logger.debug(`  msgstr type: ${Array.isArray(item.msgstr) ? 'Array' : typeof item.msgstr}`);
			this.logger.debug(`  msgstr length: ${Array.isArray(item.msgstr) ? item.msgstr.length : 'N/A'}`);
			this.logger.debug(`  msgstr content: ${JSON.stringify(item.msgstr)}`);

			// Find the corresponding entry in outputPoData and update it.
			for (const contextKey in outputPoData.translations) {
				const context = outputPoData.translations[contextKey];

				if (context[item.msgid]) {
					// If item has context info, only update if contexts match.
					if (item.msgctxt !== undefined && contextKey !== (item.msgctxt || '')) {
						continue;
					}

					this.logger.debug(`  Found entry in context "${contextKey}"`);
					this.logger.debug(`  Before update: ${JSON.stringify(context[item.msgid].msgstr)}`);

					context[item.msgid].msgstr = item.msgstr;

					this.logger.debug(`  After update: ${JSON.stringify(context[item.msgid].msgstr)}`);
					break;
				}
			}
		}
	}

	/**
	 * Saves PO data to a .po file using the configured template and formatting.
	 * Validates successful save operation and throws on failure.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} outputPoData - PO data structure to save.
	 * @param {string} language - Target language code.
	 * @param {string} outputFile - Path to output .po file.
	 *
	 * @return {Promise<void>} Resolves when file is saved successfully.
	 *
	 * @throws {Error} If file save operation fails.
	 */
	async _savePoFile(outputPoData, language, outputFile) {
		const success = await compilePoFile(outputPoData, language, outputFile, this.logger, this.config.poHeaderTemplatePath);

		if (!success) {
			throw new Error(`Failed to save .po file: ${outputFile}`);
		}
	}

	/**
	 * Processes an actual translation batch (non-dry-run).
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Translation batch to process.
	 * @param {string} language - Target language code.
	 * @param {number} batchNumber - Current batch number.
	 * @param {number} totalBatches - Total number of batches.
	 * @param {Function|null} progressCallback - Optional callback for progress updates.
	 * @param {number} processedStringsCount - Current count of processed strings.
	 * @param {number} totalStringsToTranslate - Total number of strings to translate.
	 * @param {number} processStartTime - Start time of the entire process in milliseconds.
	 *
	 * @return {Promise<Object>} Object containing batch result and translated items.
	 */
	async _processActualBatch(batch, language, batchNumber, totalBatches, progressCallback, processedStringsCount, totalStringsToTranslate, processStartTime) {
		const systemPrompt = buildSystemPrompt(language, this.config.sourceLanguage, this.config.promptFilePath);

		// Calculate plural count for target language.
		const pluralFormsString = getPluralForms(language, this.logger);
		const pluralCount = extractPluralCount(pluralFormsString);

		// Create a function to update progress with current state.
		const updateProgress = (retryInfo = null) => {
			// Add retry status to the existing progress callback.
			const retryStatus = retryInfo && retryInfo.isRetrying ? ` (retry ${retryInfo.attempt}/${retryInfo.maxRetries})` : '';

			// Call the main progress callback with retry info.
			this._updateProgressCallback(progressCallback, processedStringsCount, totalStringsToTranslate, language, batchNumber, totalBatches, null, processStartTime, retryStatus);
		};

		// Set up real-time progress updates every 2 seconds.
		let progressTimer = null;
		if (progressCallback) {
			// Initial progress update.
			updateProgress();

			// Start timer for periodic updates.
			progressTimer = setInterval(() => {
				updateProgress();
			}, 500); // Update every 500ms for real-time feel.
		}

		const retryProgressCallback = (retryInfo) => {
			// Update progress with retry information.
			updateProgress(retryInfo);
		};

		// Prepare debug configuration if debug mode is enabled.
		const debugConfig = this.config.saveDebugInfo
			? {
					saveDebugInfo: true,
					outputDir: this.config.outputDir || '.',
					targetLang: language,
					batchNum: batchNumber,
					totalBatches,
				}
			: null;

		let batchResult;

		try {
			batchResult = await this.provider.translateBatch(batch, language, this.config.model, systemPrompt, this.config.maxRetries, this.config.retryDelayMs, this.config.timeout, this.config.dryRun, retryProgressCallback, debugConfig, pluralCount);
		} finally {
			// Clear the progress timer.
			if (progressTimer) {
				clearInterval(progressTimer);
			}
		}

		let translatedBatchItems;

		if (batchResult.success) {
			translatedBatchItems = batchResult.translations.map((t, index) => {
				const originalItem = batch[index];

				// Handle plural forms (msgstr is already an array).
				if (Array.isArray(t.msgstr)) {
					return {
						msgid: t.msgid,
						msgstr: t.msgstr,
						msgctxt: originalItem.msgctxt,
						dryRun: batchResult.isDryRun,
					};
				}

				// Handle regular strings (wrap in array).
				return {
					msgid: t.msgid,
					msgstr: [t.msgstr || ''],
					msgctxt: originalItem.msgctxt,
					dryRun: batchResult.isDryRun,
				};
			});
		} else {
			this.logger.error(`Batch ${batchNumber} failed: ${batchResult.error || 'Unknown error'}`);

			translatedBatchItems = batch.map((item) => ({
				msgid: item.msgid,
				msgstr: [''],
				msgctxt: item.msgctxt,
				error: batchResult.error || 'Translation failed',
			}));
		}

		return {
			...batchResult,
			translatedBatchItems,
		};
	}

	/**
	 * Handles batch failure scenarios based on configuration settings.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} batchResult - Result from failed batch processing.
	 * @param {Array} batch - Translation batch that failed.
	 * @param {number} batchNumber - Current batch number.
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {Object} outputPoData - PO data structure to update.
	 * @param {string} language - Target language code.
	 * @param {string} outputFile - Path to output .po file.
	 * @param {number} successfullyTranslatedCount - Current success count.
	 * @param {number} actuallyFailedCount - Current failure count.
	 * @param {number} processedStringsCount - Current processed count.
	 *
	 * @return {Promise<Object>} Object containing updated counts and control flags.
	 */
	async _handleBatchFailure(batchResult, batch, batchNumber, batches, currentIndex, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount) {
		const translatedBatchItems = batchResult.translatedBatchItems;

		if (this.config.stopOnMaxRetriesFailure) {
			return await this._handleStopOnFailure(translatedBatchItems, batch, batchNumber, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount);
		}

		if (this.config.skipJobOnMaxRetriesFailure) {
			return await this._handleSkipJobOnFailure(translatedBatchItems, batch, batchNumber, batches, currentIndex, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount);
		}

		this.logger.warn(`Batch ${batchNumber} failed, but continuing with remaining batches for ${language}.`);

		return {
			shouldStop: false,
			shouldThrow: false,
			successfullyTranslatedCount,
			actuallyFailedCount,
			processedStringsCount,
		};
	}

	/**
	 * Handles stop-on-failure scenario.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} translatedBatchItems - Translated items from failed batch.
	 * @param {Array} batch - Translation batch that failed.
	 * @param {number} batchNumber - Current batch number.
	 * @param {Object} outputPoData - PO data structure to update.
	 * @param {string} language - Target language code.
	 * @param {string} outputFile - Path to output .po file.
	 * @param {number} successfullyTranslatedCount - Current success count.
	 * @param {number} actuallyFailedCount - Current failure count.
	 * @param {number} processedStringsCount - Current processed count.
	 *
	 * @return {Promise<Object>} Object containing updated counts and control flags.
	 */
	async _handleStopOnFailure(translatedBatchItems, batch, batchNumber, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount) {
		this.logger.error(`Batch ${batchNumber} failed after max retries. Stopping entire translation process due to --stop-on-max-retries-failure setting.`);
		this._updatePoDataWithBatch(outputPoData, translatedBatchItems);

		const { batchSuccessCount, batchFailedCount, errorSummary } = this._countBatchResults(translatedBatchItems);

		const updatedSuccessCount = successfullyTranslatedCount + batchSuccessCount;
		const updatedFailedCount = actuallyFailedCount + batchFailedCount;
		const updatedProcessedCount = processedStringsCount + batch.length;

		this.logger.error(`Batch ${batchNumber} processed with failures. Success: ${batchSuccessCount}, Failed: ${batchFailedCount}.`);

		if (batchFailedCount > 0 && errorSummary) {
			this.logger.warn(`Batch ${batchNumber} errors: ${errorSummary}`);
		}

		await this._savePoFile(outputPoData, language, outputFile);

		return {
			shouldStop: true,
			shouldThrow: true,
			errorMessage: `Translation stopped: Batch ${batchNumber} for ${language} failed after ${this.config.maxRetries} retries`,
			successfullyTranslatedCount: updatedSuccessCount,
			actuallyFailedCount: updatedFailedCount,
			processedStringsCount: updatedProcessedCount,
		};
	}

	/**
	 * Handles skip-job-on-failure scenario.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} translatedBatchItems - Translated items from failed batch.
	 * @param {Array} batch - Translation batch that failed.
	 * @param {number} batchNumber - Current batch number.
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {Object} outputPoData - PO data structure to update.
	 * @param {string} language - Target language code.
	 * @param {string} outputFile - Path to output .po file.
	 * @param {number} successfullyTranslatedCount - Current success count.
	 * @param {number} actuallyFailedCount - Current failure count.
	 * @param {number} processedStringsCount - Current processed count.
	 *
	 * @return {Promise<Object>} Object containing updated counts and control flags.
	 */
	async _handleSkipJobOnFailure(translatedBatchItems, batch, batchNumber, batches, currentIndex, outputPoData, language, outputFile, successfullyTranslatedCount, actuallyFailedCount, processedStringsCount) {
		this.logger.warn(`Batch ${batchNumber} failed after max retries. Skipping remaining batches for ${language} due to --skip-job-on-max-retries-failure setting.`);

		const remainingBatches = batches.length - currentIndex;
		let updatedFailedCount = actuallyFailedCount;
		let updatedProcessedCount = processedStringsCount;

		if (remainingBatches > 1) {
			const remainingStrings = batches.slice(currentIndex + 1).reduce((sum, batch) => sum + batch.length, 0);

			this.logger.info(`Skipping ${remainingBatches - 1} remaining batches (${formatNumber(remainingStrings || 0)} strings) for ${language}.`);
			updatedFailedCount += remainingStrings;
			updatedProcessedCount += remainingStrings;
		}

		this._updatePoDataWithBatch(outputPoData, translatedBatchItems);

		const { batchSuccessCount, batchFailedCount, errorSummary } = this._countBatchResults(translatedBatchItems);

		const updatedSuccessCount = successfullyTranslatedCount + batchSuccessCount;

		updatedFailedCount += batchFailedCount;
		updatedProcessedCount += batch.length;

		this.logger.warn(`Batch ${batchNumber} processed with failures. Success: ${batchSuccessCount}, Failed: ${batchFailedCount}.`);

		if (batchFailedCount > 0 && errorSummary) {
			this.logger.warn(`Batch ${batchNumber} errors: ${errorSummary}`);
		}

		await this._savePoFile(outputPoData, language, outputFile);

		this.logger.info(`${language} processing stopped due to batch failure. Partial data saved to ${outputFile}.`);

		return {
			shouldStop: true,
			shouldThrow: false,
			successfullyTranslatedCount: updatedSuccessCount,
			actuallyFailedCount: updatedFailedCount,
			processedStringsCount: updatedProcessedCount,
		};
	}

	/**
	 * Checks if processing should stop after a batch due to cost limits.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batches - All translation batches.
	 * @param {number} currentIndex - Current batch index.
	 * @param {number} skippedDueToBudgetCount - Current count of skipped strings.
	 * @param {number} processedStringsCount - Current count of processed strings.
	 * @param {string} language - Target language code.
	 *
	 * @return {boolean} True if processing should stop.
	 */
	_shouldStopAfterBatch(batches, currentIndex, skippedDueToBudgetCount, processedStringsCount, language) {
		if (this.config.maxCostRemaining === undefined || this.config.maxCostRemaining === null || this.costAccumulator.getTotals().totalCost < this.config.maxCostRemaining) {
			return false;
		}

		this.logger.info(`Cost limit approaching. Current cost: ${formatCost(this.costAccumulator.getTotals().totalCost)}, Limit: ${formatCost(this.config.maxCostRemaining)}`);
		this.logger.info(`Stopping translation for ${language} to avoid exceeding budget.`);

		const remainingBatches = batches.length - (currentIndex + 1);

		if (remainingBatches > 0) {
			const remainingStrings = batches.slice(currentIndex + 1).reduce((sum, batch) => sum + batch.length, 0);

			this.logger.info(`Skipping ${remainingBatches} remaining batches (${formatNumber(remainingStrings || 0)} strings) due to cost limit.`);
		}

		return true;
	}

	/**
	 * Logs final summary information after batch processing.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code.
	 * @param {number} successfullyTranslatedCount - Total successful translations.
	 * @param {Array} batches - All translation batches.
	 * @param {number} skippedDueToBudgetCount - Count of strings skipped due to budget.
	 * @param {string} outputFile - Path to output .po file.
	 */
	_logFinalSummary(language, successfullyTranslatedCount, batches, skippedDueToBudgetCount, outputFile) {
		if (this.config.dryRun) {
			this._logDryRunSummary(language, successfullyTranslatedCount, batches, outputFile);
		}

		this._logBudgetSummary(language, successfullyTranslatedCount, skippedDueToBudgetCount);
	}

	/**
	 * Logs dry run summary information.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code.
	 * @param {number} successfullyTranslatedCount - Total successful translations.
	 * @param {Array} batches - All translation batches.
	 * @param {string} outputFile - Path to output .po file.
	 */
	_logDryRunSummary(language, successfullyTranslatedCount, batches, outputFile) {
		const totalCostData = this.costAccumulator.getTotals();

		this.logger.info(`=== DRY RUN SUMMARY FOR ${language.toUpperCase()} ===`);
		this.logger.info(`Total strings that would be translated: ${formatNumber(successfullyTranslatedCount || 0)}`);
		this.logger.info(`Total batches that would be processed: ${batches.length}`);
		this.logger.info(`Estimated total tokens: ${formatNumber(totalCostData.totalTokens)} (includes estimated output tokens)`);
		this.logger.info(`Estimated total cost: $${formatCost(totalCostData.totalCost)} (input + estimated output cost)`);
		this.logger.info(`Estimated time (rough): ${Math.ceil((batches.length * 10) / 60)} minutes`);
		this.logger.info(`Output file would be saved to: ${outputFile}`);
		this.logger.info(`📊 Note: Token counts and costs are estimates based on input analysis + 1.4x output multiplier`);
		this.logger.info(`=== END DRY RUN SUMMARY ===`);
	}

	/**
	 * Logs budget-related summary information.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {string} language - Target language code.
	 * @param {number} successfullyTranslatedCount - Total successful translations.
	 * @param {number} skippedDueToBudgetCount - Count of strings skipped due to budget.
	 */
	_logBudgetSummary(language, successfullyTranslatedCount, skippedDueToBudgetCount) {
		if (successfullyTranslatedCount === 0 && this.config.maxCostRemaining && !this.config.dryRun) {
			const totalCostData = this.costAccumulator.getTotals();

			if (totalCostData.totalCost === 0) {
				this.logger.info(`💰 No translations processed for ${language} - skipped due to budget limit (${formatCost(this.config.maxCostRemaining)})`);
				this.logger.info(`💡 Consider increasing --max-cost or reducing --batch-size for smaller batches`);
			}
		}

		if (this.config.maxCostRemaining && !this.config.dryRun && skippedDueToBudgetCount > 0) {
			const totalCostData = this.costAccumulator.getTotals();

			if (totalCostData.totalCost > 0 && totalCostData.totalCost >= this.config.maxCostRemaining * BUDGET_WARNING_THRESHOLD) {
				this.logger.info(`💰 ${language}: ${formatNumber(skippedDueToBudgetCount || 0)} strings skipped due to budget limit (${formatCost(totalCostData.totalCost)}/${formatCost(this.config.maxCostRemaining)})`);
			}
		}
	}

	/**
	 * Counts all entries in the POT file across all contexts.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} potData - Parsed POT data structure.
	 *
	 * @return {number} Total count of entries in the POT file.
	 */
	_countAllPotEntries(potData) {
		let totalEntries = 0;

		for (const context in potData.translations) {
			const contextEntries = Object.keys(potData.translations[context]).filter((key) => key !== ''); // exclude header

			totalEntries += contextEntries.length;
		}

		return totalEntries;
	}
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Provider } from '../base/Provider.js';
import { buildXmlPrompt, parseXmlResponse, buildDictionaryResponse } from '../../utils/xmlTranslation.js';
import { loadDictionary, findDictionaryMatches } from '../../utils/dictionaryUtils.js';

/**
 * Gemini Provider Implementation.
 *
 * Handles translation using Google's Gemini models.
 * Implements the Provider interface with Gemini-specific functionality.
 *
 * @since 1.0.0
 */
export class GeminiProvider extends Provider {
	/**
	 * Creates a new Gemini Provider instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Gemini provider configuration.
	 * @param {Object} logger - Logger instance.
	 */
	constructor(config, logger) {
		super(config, logger);

		this.client = null;
	}

	/**
	 * Initializes the Gemini provider.
	 * Sets up authentication and loads pricing information.
	 *
	 * @since 1.0.0
	 *
	 * @throws {Error} If API key is missing or initialization fails.
	 *
	 * @return {Promise<void>} Resolves when initialization is complete.
	 */
	async initialize() {
		if (!this.config.apiKey && !this.config.dryRun) {
			throw new Error('API key is required for non-dry-run mode');
		}

		if (!this.config.dryRun && this.config.apiKey) {
			const genAI = new GoogleGenerativeAI(this.config.apiKey);
			this.client = genAI.getGenerativeModel({ model: this.config.model });
		}

		await this._loadProviderPricing('gemini');

		this.logger.debug(`Gemini provider initialized with model: ${this.config.model}`);
	}

	/**
	 * Validates Gemini provider configuration.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration to validate.
	 *
	 * @return {Object} Validation result.
	 */
	validateConfig(config) {
		const errors = [];

		if (!config.dryRun && !config.apiKey) {
			errors.push('API key is required (set API_KEY or use --dry-run)');
		}

		const supportedModels = this.getSupportedModels();

		if (config.model && !supportedModels.includes(config.model)) {
			errors.push(`Unsupported model: ${config.model}. Supported: ${supportedModels.join(', ')}`);
		}

		if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
			errors.push('Temperature must be between 0.0 and 2.0');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Translates a batch of strings using Gemini's API.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array}    batch                - Array of translation items.
	 * @param {string}   targetLang           - Target language code.
	 * @param {string}   model                - Gemini model to use.
	 * @param {string}   systemPrompt         - System prompt for translation.
	 * @param {number}   maxRetries           - Maximum retry attempts.
	 * @param {number}   retryDelayMs         - Delay between retries.
	 * @param {number}   timeout              - Request timeout.
	 * @param {boolean}  isDryRun             - Whether this is a dry run.
	 * @param {Function} retryProgressCallback - Optional callback for retry progress updates.
	 * @param {Object}   debugConfig          - Optional debug configuration object.
	 * @param {number}   pluralCount          - Number of plural forms for target language.
	 *
	 * @return {Promise<Object>} Translation result.
	 */
	async translateBatch(batch, targetLang, model, systemPrompt, maxRetries, retryDelayMs, timeout, isDryRun, retryProgressCallback = null, debugConfig = null, pluralCount = 1) {
		let dictionaryMatches = [];

		if (this.config.useDictionary) {
			const dictionary = loadDictionary(this.config.dictionaryPath, targetLang, this.logger);

			dictionaryMatches = findDictionaryMatches(batch, dictionary);

			if (dictionaryMatches.length > 0) {
				this.logger.info(`Using dictionary: Found ${dictionaryMatches.length} matching terms for ${targetLang}: ${dictionaryMatches.map((m) => m.source).join(', ')}`);
			} else {
				this.logger.debug(`No dictionary matches found for ${targetLang} in this batch`);
			}
		}

		const promptResult = buildXmlPrompt(batch, targetLang, pluralCount, dictionaryMatches);
		const xmlPrompt = promptResult.xmlPrompt;

		const messages = [
			{ role: 'user', content: systemPrompt },
			{ role: 'model', content: 'OK' },
			{ role: 'user', content: xmlPrompt },
		];

		if (dictionaryMatches.length > 0) {
			const dictionaryResponse = buildDictionaryResponse(dictionaryMatches);

			messages.push({ role: 'model', content: dictionaryResponse });

			const exampleTerms = dictionaryMatches
				.slice(0, 2)
				.map((match) => `"${match.source}" MUST be translated as "${match.target}"`)
				.join(' and ');

			const instruction = `IMPORTANT: When translating the following strings, you MUST use the exact dictionary translations shown above for any terms that appear in the dictionary. For example, ${exampleTerms}. Use these exact translations, not alternatives. Now translate the actual strings:`;

			messages.push({
				role: 'user',
				content: instruction,
			});
		}

		if (isDryRun) {
			return this._handleDryRun(messages, model, batch, pluralCount, promptResult.dictionaryCount);
		}

		return await this._makeApiCallWithRetries(messages, model, batch, maxRetries, retryDelayMs, retryProgressCallback, debugConfig, pluralCount, promptResult.dictionaryCount);
	}

	/**
	 * Calculates cost based on Gemini token usage.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} usage - Token usage from Gemini API response.
	 * @param {string} model - Model used.
	 *
	 * @return {Object} Cost breakdown.
	 */
	calculateCost(usage, model) {
		if (!usage || typeof usage !== 'object') {
			return {
				promptCost: 0,
				completionCost: 0,
				totalCost: 0,
				model,
				error: 'Invalid usage data',
			};
		}

		const { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens } = usage;

		if (!promptTokens && !completionTokens) {
			return {
				promptCost: 0,
				completionCost: 0,
				totalCost: 0,
				model,
				error: 'No token usage data',
			};
		}

		const pricingUsed = this.getModelPricing(model);
		const promptCost = (promptTokens / 1000) * pricingUsed.prompt;
		const completionCost = (completionTokens / 1000) * pricingUsed.completion;
		const totalCost = promptCost + completionCost;

		return {
			model,
			promptTokens,
			completionTokens,
			totalTokens,
			promptCost,
			completionCost,
			totalCost,
			pricingUsed,
		};
	}

	/**
	 * Gets token count using Gemini's API.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} text  - Text to count tokens for.
	 * @param {string} model - Model to use for tokenization.
	 *
	 * @return {number} Token count.
	 */
	async getTokenCount(text, model) {
 		if (!text || typeof text !== 'string') {
 			return 0;
 		}
 
		if (!this.client) {
			this.logger.warn('Client not initialized, using fallback token count');
			return Math.ceil(text.length / 4);
		}
 
 		try {
 			const response = await this.client.countTokens(text);
 			return response.totalTokens;
 		} catch (error) {
 			this.logger.warn(`Failed to get exact token count: ${error.message}`);
 
 			return Math.ceil(text.length / 4);
 		}
 	}

	/**
	 * Gets supported Gemini models.
	 * Returns all models from the pricing configuration.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<string>} Supported model identifiers.
	 */
	getSupportedModels() {
		if (this.providerPricing && this.providerPricing.models) {
			return Object.keys(this.providerPricing.models).sort();
		}

		return ['gemini-2.5-pro', 'gemini-2.5-flash'];
	}

	/**
	 * Gets Gemini model pricing.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} model - Model to get pricing for.
	 *
	 * @return {Object} Pricing information.
	 */
	getModelPricing(model) {
		if (!this.providerPricing) {
			return { prompt: 0.0005, completion: 0.0015 };
		}

		return this.providerPricing.models[model] || this.providerPricing.fallback;
	}

	/**
	 * Gets the provider name.
	 *
	 * @since 1.0.0
	 *
	 * @return {string} Provider name.
	 */
	getProviderName() {
		return 'gemini';
	}

	/**
	 * Estimates output tokens based on input tokens.
	 * Uses a conservative multiplier for Gemini models.
	 *
	 * @since 1.0.0
	 *
	 * @param {number} inputTokens - Number of input tokens.
	 * @param {string} targetLang - Target language (unused in base implementation).
	 *
	 * @return {number} Estimated output tokens.
	 */
	estimateOutputTokens(inputTokens, targetLang) {
		// Use conservative.1.4x multiplier for Gemini.
		return Math.round(inputTokens * 1.4);
	}

	/**
	 * Gets Gemini-specific fallback pricing when pricing file cannot be loaded.
	 *
	 * @since 1.0.0
	 *
	 * @return {Object} Gemini fallback pricing structure.
	 *
	 * @protected
	 */
	_getFallbackPricing() {
		return {
			models: {
				'gemini-2.5-flash': { prompt: 0.000175, completion: 0.000525 },
                 'gemini-2.5-pro':   { prompt: 0.0005,   completion: 0.0015   },

			},
			fallback: { prompt: 0.0005, completion: 0.0015 },
		};
	}

	/**
	 * Handles dry-run mode by estimating costs without API calls.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} messages - Chat messages for the API.
	 * @param {string} model - Model to use.
	 * @param {Array} batch - Translation batch.
	 * @param {number} pluralCount - Number of plural forms for target language.
	 *
	 * @return {Object} Dry-run result with estimated costs.
	 *
	 * @private
	 */
	async _handleDryRun(messages, model, batch, pluralCount, dictionaryCount) {
		// Calculate input tokens.
		const fullPrompt = messages.map((m) => m.content).join('\n');
		const inputTokens = await this.getTokenCount(fullPrompt, model);

		// Estimate output tokens.
		const estimatedOutputTokens = this.estimateOutputTokens(inputTokens);

		// Calculate estimated costs.
		const pricing = this.getModelPricing(model);
		const inputCost = (inputTokens / 1000) * pricing.prompt;
		const outputCost = (estimatedOutputTokens / 1000) * pricing.completion;
		const totalCost = inputCost + outputCost;

		// Generate dry run translations with proper plural forms.
		const translations = batch.map((item) => {
			const msgstr = Array(pluralCount).fill(`[DRY RUN] ${item.msgid}`);

			return { msgid: item.msgid, msgstr };
		});

		return {
			success: true,
			translations,
			usage: {
				prompt_tokens: inputTokens,
				completion_tokens: estimatedOutputTokens,
				total_tokens: inputTokens + estimatedOutputTokens,
			},
			cost: {
				model,
				promptTokens: inputTokens,
				completionTokens: estimatedOutputTokens,
				totalTokens: inputTokens + estimatedOutputTokens,
				promptCost: inputCost,
				completionCost: outputCost,
				totalCost,
				pricingUsed: pricing,
				isDryRun: true,
				dictionaryCount,
			},
			isDryRun: true,
			debugData: {
				messages,
				batchSize: batch.length,
			},
		};
	}

	/**
	 * Makes API call with retry logic.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} messages - Chat messages.
	 * @param {string} model - Model to use.
	 * @param {Array} batch - Translation batch.
	 * @param {number} maxRetries - Maximum retries.
	 * @param {number} retryDelayMs - Retry delay.
	 * @param {Function} retryProgressCallback - Optional callback for retry progress updates.
	 * @param {Object} debugConfig - Optional debug configuration object.
	 * @param {number} pluralCount - Number of plural forms for target language.
	 *
	 * @return {Promise<Object>} API call result.
	 *
	 * @private
	 */
	async _makeApiCallWithRetries(messages, model, batch, maxRetries, retryDelayMs, retryProgressCallback = null, debugConfig = null, pluralCount = 1, dictionaryCount = 0) {
		let lastError = null;

		// Debug: Log complete conversation at verbose level.3.
		this.logger.debug('=== FULL CONVERSATION WITH AI ===');

		messages.forEach((message, index) => {
			this.logger.debug(`Message ${index + 1} (${message.role}):`);
			this.logger.debug(message.content);
			if (index < messages.length - 1) {
				this.logger.debug('---');
			}
		});

		this.logger.debug('=== END CONVERSATION ===');

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Notify progress callback about retry status.
				this._notifyRetryProgress(retryProgressCallback, attempt, maxRetries);

				if (attempt > 0) {
					this.logger.info(`Retry attempt ${attempt}/${maxRetries} after ${retryDelayMs}ms delay`);

					await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
				}

				// Handle test mode failure simulation.
				this._handleTestModeFailures(attempt, maxRetries);

				const history = messages.slice(0, -1).map((message) => ({
					role: message.role,
					parts: [{ text: message.content || '' }],
				}));

				const chat = this.client.startChat({
					history,
					generationConfig: {
						temperature: this.config.temperature || 0.1,
						maxOutputTokens: this._calculateMaxTokens(model, batch.length),
					},
				});

				const lastMessage = messages[messages.length - 1];
				const result = await chat.sendMessage(lastMessage.content || '');
				const response = await result.response;
				const responseText = response.text();

				// Debug: Log raw AI response at verbose level.3.
				this.logger.debug('=== RAW AI RESPONSE ===');
				this.logger.debug(responseText);
				this.logger.debug('=== END RAW RESPONSE ===');

				// Save debug files if enabled.
				if (debugConfig && debugConfig.saveDebugInfo) {
					await this._saveDebugFiles(messages, response, debugConfig, batch.length);
				}

				// Parse response.
				const translations = this._parseApiResponse(responseText, batch, pluralCount, dictionaryCount);

				// Debug: Log parsed translations at verbose level.3.
				this.logger.debug('=== PARSED TRANSLATIONS ===');

				translations.forEach((translation, index) => {
					this.logger.debug(`${index + 1}. "${translation.msgid}" → ${JSON.stringify(translation.msgstr)}`);
				});

				this.logger.debug('=== END PARSED TRANSLATIONS ===');

				const usage = {
					prompt_tokens: await this.getTokenCount(messages.map(m => m.content || '').join('\n'), model),
					completion_tokens: await this.getTokenCount(responseText, model),
				};
				usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

				const cost = this.calculateCost(usage, model);

				// Notify progress callback that we're no longer retrying.
				this._notifyRetryProgress(retryProgressCallback, attempt, maxRetries, false);

				return {
					success: true,
					translations,
					usage,
					cost,
					isDryRun: false,
					debugData: {
						messages,
						response: responseText,
					},
					dictionaryCount,
				};
			} catch (error) {
				lastError = error;

				this.logger.warn(`API call attempt ${attempt + 1} failed: ${error.message}`);

				// Don't retry on certain errors.
				if (this._shouldStopRetrying(error)) {
					break;
				}
			}
		}

		// Final progress callback update to clear retry status.
		this._notifyRetryProgress(retryProgressCallback, maxRetries, maxRetries, false);

		return {
			success: false,
			error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`,
			translations: [],
			cost: { totalCost: 0 },
			dictionaryCount,
		};
	}

	/**
	 * Notifies retry progress callback if provided.
	 *
	 * @private
	 * @since 1.0.0
	 * @param {Function} callback - Progress callback function.
	 * @param {number} attempt - Current attempt number.
	 * @param {number} maxRetries - Maximum retry attempts.
	 * @param {boolean} isRetrying - Whether currently retrying.
	 */
	_notifyRetryProgress(callback, attempt, maxRetries, isRetrying = true) {
		if (!callback) {
			return;
		}

		callback({
			isRetrying: isRetrying && attempt > 0,
			attempt,
			maxRetries,
		});
	}

	/**
	 * Determines if retrying should stop based on error type.
	 *
	 * @private
	 * @since 1.0.0
	 * @param {Error} error - The error that occurred.
	 * @return {boolean} True if retrying should stop.
	 */
	_shouldStopRetrying(error) {
		return error.status === 401 || error.status === 403;
	}

	/**
	 * Handles test mode failure simulation for retry logic testing.
	 *
	 * @private
	 * @since 1.0.0
	 * @param {number} attempt - Current attempt number.
	 * @param {number} maxRetries - Maximum retry attempts.
	 * @throws {Error} Simulated API error for testing.
	 */
	_handleTestModeFailures(attempt, maxRetries) {
		if (!this.config.testRetryFailureRate || this.config.testRetryFailureRate <= 0) {
			return;
		}

		const shouldFail = Math.random() < this.config.testRetryFailureRate;

		if (!shouldFail) {
			return;
		}

		// Check if we should fail this attempt.
		const isFinalAttempt = attempt === maxRetries;
		const shouldProtectFinalAttempt = !this.config.testAllowCompleteFailure;

		if (isFinalAttempt && shouldProtectFinalAttempt) {
			this.logger.info(`🧪 TEST MODE: Would simulate failure but allowing final attempt to succeed (final attempt protection enabled)`);
			return;
		}

		this.logger.warn(`🧪 TEST MODE: Simulating API failure (attempt ${attempt + 1}/${maxRetries + 1}) - failure rate: ${(this.config.testRetryFailureRate * 100).toFixed(1)}%`);

		const errorType = this._getRandomTestError();

		this.logger.warn(`🧪 TEST MODE: Simulating ${errorType.status ? `HTTP ${errorType.status}` : 'network'} error: ${errorType.message}`);

		const testError = new Error(errorType.message);

		if (errorType.status) {
			testError.status = errorType.status;
		}

		// For rate limiting, add some extra properties that Gemini API might include.
		if (errorType.status === 429) {
			testError.response = {
				headers: {
					'retry-after': '60',
					'x-ratelimit-remaining': '0',
				},
			};
		}

		throw testError;
	}

	/**
	 * Gets a random test error for failure simulation.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @return {Object} Random error configuration.
	 */
	_getRandomTestError() {
		const errorTypes = [
			{ status: 429, message: 'Rate limit exceeded. Please retry after 60 seconds.' },
			{ status: 500, message: 'Internal server error' },
			{ status: 502, message: 'Bad gateway' },
			{ status: 503, message: 'Service temporarily unavailable' },
			{ status: 504, message: 'Gateway timeout' },
			{ status: null, message: 'Network connection failed' }, // Simulate network error.
		];

		return errorTypes[Math.floor(Math.random() * errorTypes.length)];
	}

	/**
	 * Parses API response and extracts translations.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} responseContent - API response content.
	 * @param {Array} batch - Original batch for fallback.
	 * @param {number} pluralCount - Number of plural forms for target language.
	 * @param {number} dictionaryCount - Number of dictionary entries to skip.
	 *
	 * @return {Array} Parsed translations.
	 *
	 * @private
	 */
	_parseApiResponse(responseContent, batch, pluralCount, dictionaryCount = 0) {
		try {
			return parseXmlResponse(responseContent, batch, pluralCount, this.logger, dictionaryCount);
		} catch (error) {
			this.logger.warn(`Failed to parse API response: ${error.message}`);

			// Return empty translations as fallback.
			return batch.map((item) => ({
				msgid: item.msgid,
				msgstr: Array(pluralCount).fill(''),
			}));
		}
	}

	/**
	 * Saves API request and response data to debug files when debug mode is enabled.
	 * Creates timestamped files with detailed information for troubleshooting.
	 *
	 * @private
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} messages - The API request messages sent to Gemini.
	 * @param {Object} response - The full API response from Gemini.
	 * @param {Object} debugConfig - Debug configuration object.
	 * @param {number} batchSize - Size of the batch for max_tokens calculation.
	 *
	 * @return {Promise<void>} Resolves when debug files are saved successfully.
	 */
	async _saveDebugFiles(messages, response, debugConfig, batchSize) {
		try {
			const fs = await import('fs');
			const path = await import('path');

			// Create debug directory if it doesn't exist.
			const debugDir = path.join(debugConfig.outputDir || '.', 'debug');

			if (!fs.existsSync(debugDir)) {
				fs.mkdirSync(debugDir, { recursive: true });
			}

			// Create timestamp for unique file naming.
			const now = new Date();
			const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD.
			const timeStr = now.toISOString().slice(11, 16).replace(':', ''); // HHMM.
			const batchStr = `${debugConfig.batchNum}-of-${debugConfig.totalBatches}`;
			const filePrefix = `${dateStr}--${timeStr}--${debugConfig.targetLang}--${batchStr}`;

			// Prepare debug data with metadata and complete request parameters.
			const { totalBatches } = debugConfig;
			const { model } = this.config;
			const debugData = {
				metadata: {
					timestamp: new Date().toISOString(),
					targetLanguage: debugConfig.targetLang,
					batchNumber: debugConfig.batchNum,
					totalBatches,
					model,
				},
				request: {
					model,
					messages,
					temperature: this.config.temperature || 0.1,
					max_tokens: this._calculateMaxTokens(model, batchSize),
					systemPromptLength: messages[0].content.length,
					userMessageLength: messages[1].content.length,
				},
				response,
			};

			// Save debug file.
			const debugFilePath = path.join(debugDir, `${filePrefix}.json`);

			fs.writeFileSync(debugFilePath, JSON.stringify(debugData, null, 2), 'utf8');

			this.logger.debug(`Debug file saved: ${debugFilePath}`);
		} catch (error) {
			this.logger.warn(`Failed to save debug files: ${error.message}`);
		}
	}

	/**
	 * Calculates max_tokens value with smart auto-calculation.
	 * When not configured, estimates based on batch size and expected output.
	 *
	 * @private
	 * @since 1.0.0
	 * @param {string} model - Gemini model (for token estimation).
	 * @param {number} batchSize - Number of items in the batch.
	 * @return {number} Max tokens value.
	 */
	_calculateMaxTokens(model, batchSize) {
		// Use configured value if provided.
		if (this.config.maxTokens) {
			this.logger.debug(`Using configured max_tokens: ${this.config.maxTokens} for batch of ${batchSize} string${batchSize === 1 ? '' : 's'}`);

			return this.config.maxTokens;
		}

		// Auto-calculate based on batch size and expected output.
		const estimatedTokensPerString = this._estimateTokensPerString();
		const estimatedOutputTokens = batchSize * estimatedTokensPerString;

		// Add safety buffer (30%) to account for:
		// - Longer translations in some languages.
		// - XML formatting overhead.
		// - Some strings being longer than average.
		const safetyBuffer = 1.3;
		const calculatedMaxTokens = Math.round(estimatedOutputTokens * safetyBuffer);

		// Apply reasonable bounds.
		const minTokens = 100; // Minimum for any response.
		const maxTokens = 8192; // Gemini API limit.
		const finalMaxTokens = Math.max(minTokens, Math.min(maxTokens, calculatedMaxTokens));

		this.logger.debug(`Auto-calculated max_tokens: ${finalMaxTokens} for batch of ${batchSize} string${batchSize === 1 ? '' : 's'} (estimated: ${estimatedOutputTokens}, with 30% buffer: ${calculatedMaxTokens})`);

		return finalMaxTokens;
	}

	/**
	 * Estimates average tokens needed per string translation.
	 * Based on typical translation patterns and XML formatting overhead.
	 *
	 * @private
	 * @since 1.0.0
	 * @return {number} Estimated tokens per translated string.
	 */
	_estimateTokensPerString() {
		// Conservative estimate based on.:
		// - Average translation length (50-80 tokens.)
		// - XML formatting overhead (<translation id="1".>...</translation>)
		// - Plural forms (may double the output.)
		// - Some strings being longer than average.
		return 120;
	}
}

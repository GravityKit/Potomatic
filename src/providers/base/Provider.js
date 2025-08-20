import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Abstract Provider Base Class.
 *
 * Defines the interface that all AI translation providers must implement.
 * Provides common functionality and enforces consistent behavior across providers.
 *
 * @since 1.0.0
 */
export class Provider {
	/**
	 * Creates a new Provider instance.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Provider configuration.
	 * @param {Object} logger - Logger instance.
	 */
	constructor(config, logger) {
		if (new.target === Provider) {
			throw new Error('Provider is an abstract class and cannot be instantiated directly');
		}

		this.config = config;
		this.logger = logger;
		this.providerPricing = null;
	}

	/**
	 * Loads provider-specific pricing from configuration file.
	 * This is a generic method that can be used by all providers.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} providerName - Name of the provider (e.g., 'openai', 'anthropic')
	 *
	 * @return {Promise<void>} Resolves when pricing is loaded
	 *
	 * @protected
	 */
	async _loadProviderPricing(providerName) {
		try {
			const currentDir = path.dirname(fileURLToPath(import.meta.url));
			const configDir = path.resolve(currentDir, '../../../config');
			const pricingPath = path.join(configDir, `${providerName}-pricing.json`);
			const pricingContent = fs.readFileSync(pricingPath, 'utf-8');

			this.providerPricing = JSON.parse(pricingContent);

			this.logger.debug(`Loaded pricing for ${providerName} provider`);
		} catch (error) {
			this.logger.warn(`Could not load ${providerName} pricing: ${error.message}. Using fallback pricing.`);

			// Set fallback pricing - each provider can override this.
			this.providerPricing = this._getFallbackPricing();
		}
	}

	/**
	 * Gets fallback pricing when provider pricing file cannot be loaded.
	 * Should be overridden by each provider with their specific fallback.
	 *
	 * @since 1.0.0
	 *
	 * @return {Object} Fallback pricing structure.
	 *
	 * @protected
	 */
	_getFallbackPricing() {
		return {
			models: {},
			fallback: { prompt: 0.0005, completion: 0.0015 },
		};
	}

	/**
	 * Initializes the provider.
	 * Subclasses should override this method to perform provider-specific setup.
	 *
	 * @since 1.0.0
	 *
	 * @return {Promise<void>} Resolves when initialization is complete.
	 *
	 * @throws {Error} If initialization fails.
	 */
	async initialize() {
		throw new Error('initialize() method must be implemented by subclass');
	}

	/**
	 * Validates provider configuration.
	 * Subclasses should override this method to perform provider-specific validation.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration to validate.
	 *
	 * @return {Object} Validation result with isValid flag and errors array.
	 */
	validateConfig(config) {
		throw new Error('validateConfig() method must be implemented by subclass');
	}

	/**
	 * Translates a batch of strings.
	 * Subclasses must implement this method with provider-specific translation logic.
	 *
	 * @since 1.0.0
	 *
	 * @param {Array} batch - Array of translation items.
	 * @param {string} targetLang - Target language code.
	 * @param {string} model - Model to use.
	 * @param {string} systemPrompt - System prompt for translation.
	 * @param {number} maxRetries - Maximum retry attempts.
	 * @param {number} retryDelayMs - Delay between retries.
	 * @param {number} timeout - Request timeout.
	 * @param {boolean} isDryRun - Whether this is a dry run.
	 * @param {Function} retryProgressCallback - Optional callback for retry progress updates.
	 *
	 * @return {Promise<Object>} Translation result.
	 */
	async translateBatch(batch, targetLang, model, systemPrompt, maxRetries, retryDelayMs, timeout, isDryRun, retryProgressCallback = null) {
		throw new Error('translateBatch() method must be implemented by subclass');
	}

	/**
	 * Calculates cost based on usage data.
	 * Subclasses should override this method for provider-specific cost calculations.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} usage - Usage data from provider.
	 * @param {string} model - Model used.
	 *
	 * @return {Object} Cost breakdown.
	 */
	calculateCost(usage, model) {
		throw new Error('calculateCost() method must be implemented by subclass');
	}

	/**
	 * Gets token count for text.
	 * Subclasses should override this method for provider-specific tokenization.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} text - Text to count tokens for.
	 * @param {string} model - Model to use for tokenization.
	 *
	 * @return {number} Token count.
	 */
	getTokenCount(text, model) {
		throw new Error('getTokenCount() method must be implemented by subclass');
	}

	/**
	 * Gets supported models for this provider.
	 * Subclasses should override this method to return provider-specific models.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<string>} Supported model identifiers.
	 */
	getSupportedModels() {
		throw new Error('getSupportedModels() method must be implemented by subclass');
	}

	/**
	 * Gets the provider name.
	 * Subclasses should override this method to return the provider identifier.
	 *
	 * @since 1.0.0
	 *
	 * @return {string} Provider name.
	 */
	getProviderName() {
		throw new Error('getProviderName() method must be implemented by subclass');
	}

	/**
	 * Estimates output tokens for dry-run calculations.
	 * Subclasses can override this method for provider-specific estimation logic.
	 *
	 * @since 1.0.0
	 *
	 * @param {number} inputTokens - Input token count.
	 * @param {string} targetLang - Target language.
	 *
	 * @return {number} Estimated output tokens.
	 */
	estimateOutputTokens(inputTokens, targetLang) {
		// Default conservative estimate.
		return Math.round(inputTokens * 1.3);
	}
}

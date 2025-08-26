import { OpenAIProvider } from './openai/OpenAIProvider.js';
import { GeminiProvider } from './gemini/GeminiProvider.js';

/**
 * Creates and configures AI translation providers based on configuration.
 * Currently, supports OpenAI with a unified interface for future providers.
 *
 * @since 1.0.0
 */
export class ProviderFactory {
	/**
	 * Creates a provider instance based on configuration.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration object.
	 * @param {string} config.provider - Provider name (currently only 'openai').
	 * @param {Object} logger - Logger instance.
	 *
	 * @return {Provider} Configured provider instance.
	 *
	 * @throws {Error} If provider is unsupported or configuration is invalid.
	 */
	static createProvider(config, logger) {
		const providerName = config.provider || 'openai'; // Default to OpenAI.

		switch (providerName.toLowerCase()) {
			case 'openai':
				return new OpenAIProvider(config, logger);
			case 'gemini':
				return new GeminiProvider(config, logger);
			default:
				throw new Error(`Unsupported provider: ${providerName}. ` + `Supported providers: ${ProviderFactory.getSupportedProviders().join(', ')}`);
		}
	}

	/**
	 * Gets the list of supported provider names.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<string>} Array of supported provider names.
	 */
	static getSupportedProviders() {
		return ['openai', 'gemini'];
	}

	/**
	 * Validates that a provider name is supported.
	 *
	 * @since 1.0.0
	 *
	 * @param {string} providerName - Provider name to validate.
	 *
	 * @return {boolean} True if provider is supported.
	 */
	static isProviderSupported(providerName) {
		return ProviderFactory.getSupportedProviders().includes(providerName.toLowerCase());
	}

	/**
	 * Gets information about all providers including implementation status.
	 *
	 * @since 1.0.0
	 *
	 * @return {Array<Object>} Provider information objects.
	 */
	static getProviderInfo() {
		return [
			{
				name: 'openai',
				displayName: 'OpenAI',
				description: 'OpenAI GPT models (GPT-3.5, GPT-4, etc.)',
				status: 'implemented',
				models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o', 'gpt-4o-mini'],
				configExample: {
					provider: 'openai',
					apiKey: 'your-openai-api-key',
					model: 'gpt-3.5-turbo',
				},
			},
			{
				name: 'gemini',
				displayName: 'Google Gemini',
				description: 'Google Gemini models',
				status: 'implemented',
				models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
				configExample: {
					provider: 'gemini',
					apiKey: 'your-gemini-api-key',
					model: 'gemini-2.5-flash',
				},
			},
		];
	}

	/**
	 * Creates a provider and validates its configuration.
	 * Provides detailed error messages for easier troubleshooting.
	 *
	 * @since 1.0.0
	 *
	 * @param {Object} config - Configuration object.
	 * @param {Object} logger - Logger instance.
	 *
	 * @return {Provider} Validated provider instance.
	 *
	 * @throws {Error} If provider creation or validation fails.
	 */
	static async createAndValidateProvider(config, logger) {
		// Check if provider is supported.
		const providerName = config.provider || 'openai';

		if (!ProviderFactory.isProviderSupported(providerName)) {
			const supportedProviders = ProviderFactory.getSupportedProviders().join(', ');

			throw new Error(`Unsupported provider: ${providerName}. Supported: ${supportedProviders}`);
		}

		const provider = ProviderFactory.createProvider(config, logger);

		// Initialize provider first to load pricing data and other resources.
		await provider.initialize();

		// Validate configuration after initialization so model validation has access to pricing data.
		const validation = provider.validateConfig(config);

		if (!validation.isValid) {
			const errorMessage = validation.errors.join(', ');

			throw new Error(`Provider configuration invalid: ${errorMessage}`);
		}

		logger.debug(`Created and validated ${providerName} provider`);

		return provider;
	}
}

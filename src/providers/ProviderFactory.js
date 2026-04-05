import { OpenAIProvider } from './openai/OpenAIProvider.js';

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
		return ['openai'];
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
				description: 'OpenAI GPT models (GPT-5, GPT-5.4, etc.)',
				status: 'implemented',
				models: ['gpt-5-nano', 'gpt-5-mini', 'gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1'],
				configExample: {
					provider: 'openai',
					apiKey: 'your-openai-api-key',
					model: 'gpt-4.1-mini',
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

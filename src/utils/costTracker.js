import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Cost Tracking Utility.
 *
 * Provides functionality to track and estimate costs for AI provider API calls.
 * Supports loading pricing data from provider-specific configuration files
 * and calculating costs for various models.
 *
 * @since 1.0.0
 */

/**
 * Cached pricing data loaded from provider pricing files.
 *
 * @since 1.0.0
 *
 * @type {Map<string, Object>}
 */
const cachedPricingData = new Map();

/**
 * Emergency fallback pricing data for when config files are missing.
 * Based on common OpenAI model pricing as of late 2024.
 *
 * @since 1.0.0
 *
 * @type {Object}
 */
const EMERGENCY_FALLBACK = {
	openai: {
		models: {
			'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
			'gpt-4': { prompt: 0.03, completion: 0.06 },
			'gpt-4o': { prompt: 0.0025, completion: 0.01 },
			'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
		},
		fallback: { prompt: 0.0005, completion: 0.0015 },
	},
};

/**
 * Loads pricing data from provider-specific pricing file.
 * Implements caching to avoid repeated file reads.
 *
 * @since 1.0.0
 *
 * @param {string} providerName - Name of the provider (e.g., 'openai', 'anthropic')
 *
 * @return {Object} Pricing data object with models and fallback pricing
 */
function loadProviderPricingData(providerName) {
	if (cachedPricingData.has(providerName)) {
		return cachedPricingData.get(providerName);
	}

	try {
		const currentDir = path.dirname(fileURLToPath(import.meta.url));

		// Look for {provider}-pricing.json in the config directory relative to this module.
		const jsonPath = path.resolve(currentDir, `../../config/${providerName}-pricing.json`);

		// Fallback to working directory if not found.
		const fallbackPath = path.resolve(process.cwd(), `config/${providerName}-pricing.json`);

		let pricingContent;

		try {
			pricingContent = fs.readFileSync(jsonPath, 'utf-8');
		} catch {
			pricingContent = fs.readFileSync(fallbackPath, 'utf-8');
		}

		const pricingData = JSON.parse(pricingContent);

		if (!pricingData.models || !pricingData.fallback) {
			throw new Error(`Invalid ${providerName}-pricing.json structure: missing models or fallback`);
		}

		cachedPricingData.set(providerName, pricingData);

		return pricingData;
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.warn(`Warning: ${providerName}-pricing.json not found. Using emergency fallback pricing.`);
		} else if (error instanceof SyntaxError) {
			console.warn(`Warning: Invalid JSON in ${providerName}-pricing.json. Using emergency fallback pricing.`);
		} else if (error.message.includes(`Invalid ${providerName}-pricing.json structure`)) {
			throw new Error(`Invalid ${providerName}-pricing.json structure: missing models or fallback`);
		} else {
			console.warn(`Warning: Failed to load ${providerName}-pricing.json: ${error.message}. Using emergency fallback pricing.`);
		}

		// Use emergency fallback pricing for the provider.
		const fallbackData = EMERGENCY_FALLBACK[providerName] || {
			models: {},
			fallback: { prompt: 0.0005, completion: 0.0015 },
		};

		cachedPricingData.set(providerName, fallbackData);

		return fallbackData;
	}
}

/**
 * Calculates the cost of API usage based on token counts and model pricing.
 * Uses pricing data from provider-specific pricing file.
 *
 * @since 1.0.0
 *
 * @param {Object} usage - Usage data from API response
 * @param {number} usage.prompt_tokens - Number of prompt tokens used
 * @param {number} usage.completion_tokens - Number of completion tokens used
 * @param {string} providerName - Provider name (e.g., 'openai', 'anthropic')
 * @param {string} model - Model name used for the request
 *
 * @return {Object} Cost breakdown object
 */
export function calculateCost(usage, providerName, model) {
	if (!usage || typeof usage !== 'object') {
		return {
			model,
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			promptCost: 0,
			completionCost: 0,
			totalCost: 0,
			pricingUsed: null,
			error: 'Invalid usage data',
		};
	}

	const promptTokens = usage.prompt_tokens || usage.inputTokens || 0;
	const completionTokens = usage.completion_tokens || usage.outputTokens || 0;
	const totalTokens = usage.total_tokens || promptTokens + completionTokens;

	const pricingData = loadProviderPricingData(providerName);
	const modelPricing = pricingData.models[model] || pricingData.fallback;

	const promptCost = (promptTokens / 1000) * modelPricing.prompt;
	const completionCost = (completionTokens / 1000) * modelPricing.completion;
	const totalCost = promptCost + completionCost;

	return {
		model,
		promptTokens,
		completionTokens,
		totalTokens,
		promptCost,
		completionCost,
		totalCost,
		pricingUsed: modelPricing,
	};
}

/**
 * Creates a new cost accumulator for tracking costs across multiple requests.
 *
 * @since 1.0.0
 *
 * @return {Object} Cost accumulator with methods to add costs and get totals
 */
export function createCostAccumulator() {
	const costs = [];

	return {
		/**
		 * Adds a cost entry to the accumulator.
		 *
		 * @param {Object} costData - Cost data from calculateCost()
		 *
		 * @since 1.0.0
		 */
		addCost(costData) {
			if (costData && typeof costData === 'object') {
				costs.push(costData);
			}
		},

		/**
		 * Gets the total accumulated costs.
		 *
		 * @return {Object} Total cost breakdown
		 *
		 * @since 1.0.0
		 */
		getTotals() {
			if (costs.length === 0) {
				return {
					totalPromptTokens: 0,
					totalCompletionTokens: 0,
					totalTokens: 0,
					totalPromptCost: 0,
					totalCompletionCost: 0,
					totalCost: 0,
					requestCount: 0,
					models: [],
					isDryRun: false,
				};
			}

			const totals = costs.reduce(
				(acc, cost) => {
					acc.totalPromptTokens += cost.promptTokens || cost.inputTokens || 0;
					acc.totalCompletionTokens += cost.completionTokens || cost.outputTokens || 0;
					acc.totalTokens += cost.totalTokens || 0;
					acc.totalPromptCost += cost.promptCost || 0;
					acc.totalCompletionCost += cost.completionCost || 0;
					acc.totalCost += cost.totalCost || 0;
					acc.requestCount += 1;

					if (cost.model && !acc.models.includes(cost.model)) {
						acc.models.push(cost.model);
					}

					// Preserve dry-run flag if any cost entry is from dry-run.
					if (cost.isDryRun) {
						acc.isDryRun = true;
					}

					return acc;
				},
				{
					totalPromptTokens: 0,
					totalCompletionTokens: 0,
					totalTokens: 0,
					totalPromptCost: 0,
					totalCompletionCost: 0,
					totalCost: 0,
					requestCount: 0,
					models: [],
					isDryRun: false,
				}
			);

			return totals;
		},

		/**
		 * Gets all individual cost entries.
		 *
		 * @return {Array} Array of cost data objects
		 *
		 * @since 1.0.0
		 */
		getAllCosts() {
			return [...costs];
		},
	};
}

/**
 * Reloads pricing data from the JSON file for a specific provider.
 * Useful for updating prices without restarting the application.
 *
 * @since 1.0.0
 *
 * @param {string} providerName - Provider name to reload pricing for.
 *
 * @return {Object} Reloaded pricing data
 */
export function reloadProviderPricingData(providerName) {
	cachedPricingData.delete(providerName);

	return loadProviderPricingData(providerName);
}

/**
 * Reloads all cached pricing data.
 * Useful for updating all provider prices without restarting the application.
 *
 * @since 1.0.0
 *
 * @return {void}
 */
export function reloadAllPricingData() {
	cachedPricingData.clear();
}

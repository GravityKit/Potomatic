/**
 * Centralized cost calculation utilities for translation runs.
 * Provides functions for cost aggregation, formatting, and summary generation.
 *
 * @since 1.0.0
 */

import { createEmptyValidationStats, accumulateValidationStats, VALIDATION_TYPES, getTotalValidationIssues } from './validationStats.js';

/**
 * Calculates aggregate totals from an array of language statistics.
 * This is the single source of truth for cost and token aggregation.
 *
 * @since 1.0.0
 *
 * @param {Array} allLanguageStats - Array of language processing statistics.
 *
 * @return {Object} Aggregated totals with consistent structure.
 */
export function calculateAggregateTotals(allLanguageStats) {
	if (!Array.isArray(allLanguageStats) || allLanguageStats.length === 0) {
		return {
			languagesProcessed: 0,
			languagesWithErrors: 0,
			totalTranslated: 0,
			totalFailed: 0,
			totalCost: 0,
			totalTokens: 0,
			totalPromptTokens: 0,
			totalCompletionTokens: 0,
			isDryRun: false,
			models: [],
			methods: {},
		};
	}

	return allLanguageStats.reduce(
		(acc, stat) => {
			const translatedInRun = stat.translatedInRun || 0;
			const failedInRun = stat.failedInRun || 0;
			const totalCost = stat.costData?.totalCost || 0;
			const totalTokens = stat.costData?.totalTokens || 0;
			const promptTokens = stat.costData?.totalPromptTokens || stat.costData?.inputTokens || 0;
			const completionTokens = stat.costData?.totalCompletionTokens || stat.costData?.outputTokens || 0;

			acc.totalTranslated += translatedInRun;
			acc.totalFailed += failedInRun;
			acc.totalCost += totalCost;
			acc.totalTokens += totalTokens;
			acc.totalPromptTokens += promptTokens;
			acc.totalCompletionTokens += completionTokens;

			if (stat.error) {
				acc.languagesWithErrors++;
			} else {
				acc.languagesProcessed++;
			}

			if (stat.costData?.isDryRun) {
				acc.isDryRun = true;
			}

			if (stat.costData?.models && Array.isArray(stat.costData.models)) {
				stat.costData.models.forEach((model) => {
					if (model && !acc.models.includes(model)) {
						acc.models.push(model);
					}
				});
			}

			if (stat.method) {
				acc.methods[stat.method] = (acc.methods[stat.method] || 0) + 1;
			}

			return acc;
		},
		{
			languagesProcessed: 0,
			languagesWithErrors: 0,
			totalTranslated: 0,
			totalFailed: 0,
			totalCost: 0,
			totalTokens: 0,
			totalPromptTokens: 0,
			totalCompletionTokens: 0,
			isDryRun: false,
			models: [],
			methods: {},
		}
	);
}

/**
 * Formats a cost value as a USD currency string with consistent precision.
 *
 * @since 1.0.0
 *
 * @param {number} cost     - Cost value in USD.
 * @param {number} decimals - Number of decimal places to show (default: 4).
 *
 * @return {string} Formatted cost string (e.g., "$0.0123").
 */
export function formatCost(cost, decimals = 4) {
	if (typeof cost !== 'number' || isNaN(cost)) {
		return '$0.0000';
	}

	return `$${cost.toFixed(decimals)}`;
}

/**
 * Formats a number with locale-appropriate thousands separators.
 * Used for consistent number formatting throughout the application.
 *
 * @since 1.0.0
 *
 * @param {number} number - Number to format.
 *
 * @return {string} Formatted number string (e.g., "1,234").
 */
export function formatNumber(number) {
	if (typeof number !== 'number' || isNaN(number)) {
		return '0';
	}

	return number.toLocaleString();
}

/**
 * Formats time duration in milliseconds to a human-readable format.
 * Uses minutes and seconds format for consistency (e.g., "1m 30s", "45s").
 *
 * @since 1.0.0
 *
 * @param {number} durationMs - Duration in milliseconds.
 *
 * @return {string} Formatted time string (e.g., "1m 30s", "45s").
 */
export function formatDuration(durationMs) {
	if (typeof durationMs !== 'number' || isNaN(durationMs) || durationMs < 0) {
		return 'N/A';
	}

	const totalSeconds = Math.round(durationMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

/**
 * Creates a standardized summary object for reporting.
 * Used by both console and JSON reporters to ensure consistency.
 *
 * @since 1.0.0
 *
 * @param {Array} allLanguageStats - Array of language processing statistics.
 *
 * @return {Object} Standardized summary object.
 */
export function createSummary(allLanguageStats) {
	const totals = calculateAggregateTotals(allLanguageStats);
	const totalAlreadyTranslated = allLanguageStats.reduce((sum, stat) => sum + (stat.alreadyTranslated || 0), 0);
	const totalSkippedDueToBudget = allLanguageStats.reduce((sum, stat) => sum + (stat.skippedDueToBudget || 0), 0);
	const totalSkippedDueToLimits = allLanguageStats.reduce((sum, stat) => sum + (stat.skippedDueToLimits || 0), 0);

	// Aggregate validation stats across all languages.
	const totalValidationStats = createEmptyValidationStats();

	for (const stat of allLanguageStats) {
		if (stat.validationStats) {
			accumulateValidationStats(totalValidationStats, stat.validationStats);
		}
	}

	// Convert validation stats to snake_case for JSON consistency.
	const totalValidationFormatted = {};

	for (const key of Object.keys(VALIDATION_TYPES)) {
		const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

		totalValidationFormatted[snakeKey] = totalValidationStats[key];
	}

	// Calculate total warnings count.
	const totalWarnings = getTotalValidationIssues(totalValidationStats);

	// Count languages with warnings.
	const languagesWithWarnings = allLanguageStats.filter((stat) => {
		return stat.validationStats && getTotalValidationIssues(stat.validationStats) > 0;
	}).length;

	// Collect all errors from individual jobs.
	const errors = allLanguageStats
		.filter((stat) => stat.error)
		.map((stat) => ({
			language: stat.language,
			error: stat.error,
		}));

	return {
		status: totals.languagesWithErrors > 0 ? 'error' : 'success',
		languages_processed: totals.languagesProcessed + totals.languagesWithErrors,
		languages_successful: totals.languagesProcessed,
		languages_failed: totals.languagesWithErrors,
		languages_with_warnings: languagesWithWarnings,
		total_cost: totals.totalCost,
		total_tokens: totals.totalTokens,
		total_prompt_tokens: totals.totalPromptTokens,
		total_completion_tokens: totals.totalCompletionTokens,
		total_strings: {
			processed: totals.totalTranslated + totals.totalFailed,
			successful: totals.totalTranslated,
			already_translated: totalAlreadyTranslated,
			skipped_due_to_budget: totalSkippedDueToBudget,
			skipped_due_to_limits: totalSkippedDueToLimits,
			failed: totals.totalFailed,
			warnings: totalWarnings,
		},
		total_validation: totalValidationFormatted,
		methods_used: totals.methods,
		models_used: totals.models,
		is_dry_run: totals.isDryRun,
		errors: errors.length > 0 ? errors : undefined,
	};
}

/**
 * Gets the appropriate cost label based on whether any stats are from dry runs.
 *
 * @since 1.0.0
 *
 * @param {Array} allLanguageStats - Array of language processing statistics.
 *
 * @return {string} Cost label ('Estimated cost' or 'Total cost').
 */
export function getCostLabel(allLanguageStats) {
	const isDryRun = allLanguageStats.some((stat) => stat.costData?.isDryRun);

	return isDryRun ? 'Estimated cost' : 'Total cost';
}

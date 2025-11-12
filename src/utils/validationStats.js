/**
 * Validation statistics utilities.
 * Centralized validation type definitions and helper functions.
 *
 * @since 1.1.0
 */

/**
 * Registry of all validation types with their display names.
 *
 * @since 1.1.0
 */
export const VALIDATION_TYPES = {
	stringsWithPluralIssues: 'strings with plural issues',
};

/**
 * Creates an empty validation statistics object with all validation types initialized to 0.
 *
 * @since 1.1.0
 *
 * @return {Object} Empty validation stats object.
 */
export function createEmptyValidationStats() {
	const stats = {};

	for (const key of Object.keys(VALIDATION_TYPES)) {
		stats[key] = 0;
	}

	return stats;
}

/**
 * Calculates the total number of validation issues.
 *
 * @since 1.1.0
 *
 * @param {Object} validationStats - Validation statistics object.
 *
 * @return {number} Total number of validation issues.
 */
export function getTotalValidationIssues(validationStats) {
	if (!validationStats) {
		return 0;
	}

	let total = 0;

	for (const key of Object.keys(VALIDATION_TYPES)) {
		total += validationStats[key] || 0;
	}

	return total;
}

/**
 * Formats validation stats as a human-readable breakdown string.
 *
 * @since 1.1.0
 *
 * @param {Object} validationStats - Validation statistics object.
 *
 * @return {string} Formatted breakdown string (e.g., "2 strings with plural issues").
 */
export function formatValidationBreakdown(validationStats) {
	if (!validationStats) {
		return '';
	}

	const parts = [];

	for (const [key, label] of Object.entries(VALIDATION_TYPES)) {
		const count = validationStats[key] || 0;
		if (count > 0) {
			parts.push(`${count} ${label}`);
		}
	}

	return parts.length > 0 ? parts.join(', ') : 'no issues';
}

/**
 * Accumulates validation stats from a source object into a target object.
 *
 * @since 1.1.0
 *
 * @param {Object} target - Target validation stats object to accumulate into.
 * @param {Object} source - Source validation stats object to accumulate from.
 */
export function accumulateValidationStats(target, source) {
	if (!source) {
		return;
	}

	for (const key of Object.keys(VALIDATION_TYPES)) {
		target[key] = (target[key] || 0) + (source[key] || 0);
	}
}

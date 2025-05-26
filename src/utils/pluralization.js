/**
 * Utility functions for proper singular/plural forms in output messages.
 *
 * @since 1.0.0
 */

/**
 * Returns the correct singular or plural form of a word based on count.
 *
 * @since 1.0.0
 *
 * @param {number} count    - The count to determine singular/plural.
 * @param {string} singular - The singular form of the word.
 * @param {string} plural   - The plural form of the word (optional, defaults to singular + 's').
 *
 * @return {string} The correct form of the word.
 */
export function pluralize(count, singular, plural = null) {
	if (plural === null) {
		plural = singular + 's';
	}

	return count === 1 ? singular : plural;
}

/**
 * Returns a formatted string with count and properly pluralized word.
 *
 * @since 1.0.0
 *
 * @param {number} count    - The count to display and use for pluralization.
 * @param {string} singular - The singular form of the word.
 * @param {string} plural   - The plural form of the word (optional, defaults to singular + 's').
 *
 * @return {string} Formatted string like "1 item" or "5 items".
 */
export function formatCount(count, singular, plural = null) {
	return `${count} ${pluralize(count, singular, plural)}`;
}

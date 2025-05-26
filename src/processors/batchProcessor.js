import { countUntranslatedStrings } from '../utils/poFileUtils.js';

/**
 * Prepares batches of untranslated strings for translation processing.
 * Extracts strings that need translation and splits them into manageable batches.
 *
 * @since 1.0.0
 *
 * @param {Object} parsedPot - Parsed POT data structure containing translations.
 * @param {number} batchSize - Maximum number of strings per batch.
 * @param {Object} logger - Logger instance for outputting messages.
 * @param {number|null} maxStrings - Maximum number of strings to translate (null for no limit).
 *
 * @return {Array<Array>} Array of batches, each containing translation items.
 */
export function prepareBatches(parsedPot, batchSize, logger, maxStrings = null) {
	if (!parsedPot?.translations) {
		logger.error('Invalid .pot data: missing translations object');

		return [];
	}

	const stringsToTranslate = _extractUntranslatedStrings(parsedPot);
	const totalUntranslated = countUntranslatedStrings(parsedPot);

	logger.info(`Found ${totalUntranslated} untranslated strings`);

	if (stringsToTranslate.length === 0) {
		logger.info('No strings need translation');

		return [];
	}

	// Apply maxStrings limitation if specified.
	const finalStringsToTranslate = _applyStringLimits(stringsToTranslate, maxStrings, logger);

	if (finalStringsToTranslate.length === 0) {
		return [];
	}

	// Split into batches.
	const batches = _createBatches(finalStringsToTranslate, batchSize);

	logger.info(`Prepared ${batches.length} batches of max ${batchSize} strings each`);

	return batches;
}

/**
 * Extracts untranslated strings from parsed POT data.
 *
 * @private
 * @since 1.0.0
 * @param {Object} parsedPot - Parsed POT data structure.
 * @return {Array} Array of untranslated string objects.
 */
function _extractUntranslatedStrings(parsedPot) {
	const stringsToTranslate = [];

	for (const [contextKey, context] of Object.entries(parsedPot.translations)) {
		if (!context || typeof context !== 'object') {
			continue;
		}

		for (const [msgid, entry] of Object.entries(context)) {
			if (msgid === '' || !entry) {
				continue;
			}

			const msgstr = entry?.msgstr;

			// Check if it needs translation (empty or dry run placeholder.).
			let needsTranslation = !msgstr || msgstr.every((str) => !str);

			// Also consider dry run placeholders as needing translation.
			if (!needsTranslation && msgstr) {
				needsTranslation = msgstr.every((str) => {
					if (!str || str.trim() === '') {
						return true; // Empty strings need translation.
					}

					// Dry run placeholders also need translation.
					return str.startsWith('[DRY RUN]');
				});
			}

			if (!needsTranslation) {
				continue;
			}

			// Convert reference string to array format for consistency.
			const reference = entry?.comments?.reference;
			const references = reference ? (Array.isArray(reference) ? reference : [reference]) : [];

			// Check if this is a plural form entry.
			const isPlural = entry.msgid_plural && entry.msgid_plural !== '';

			stringsToTranslate.push({
				msgid,
				msgctxt: contextKey,
				msgid_plural: entry.msgid_plural || null,
				isPlural,
				extractedComments: entry?.comments?.extracted || '',
				comments: entry?.comments || {},
				references,
			});
		}
	}

	return stringsToTranslate;
}

/**
 * Applies string limits to the translation array.
 *
 * @private
 * @since 1.0.0
 * @param {Array} stringsToTranslate - Array of strings to translate.
 * @param {number|null} maxStrings - Maximum number of strings to translate.
 * @param {Object} logger - Logger instance.
 * @return {Array} Limited array of strings to translate.
 */
function _applyStringLimits(stringsToTranslate, maxStrings, logger) {
	if (maxStrings === null || maxStrings < 0) {
		return stringsToTranslate;
	}

	if (maxStrings === 0) {
		logger.info('maxStrings is 0, returning empty batches');

		return [];
	}

	if (stringsToTranslate.length <= maxStrings) {
		return stringsToTranslate;
	}

	const limitedStrings = stringsToTranslate.slice(0, maxStrings);

	logger.info(`Limiting translation to first ${maxStrings} strings (out of ${stringsToTranslate.length} total untranslated)`);

	return limitedStrings;
}

/**
 * Creates batches from the array of strings to translate.
 *
 * @private
 * @since 1.0.0
 * @param {Array} stringsToTranslate - Array of strings to translate.
 * @param {number} batchSize - Maximum number of strings per batch.
 * @return {Array<Array>} Array of batches.
 */
function _createBatches(stringsToTranslate, batchSize) {
	const batches = [];

	for (let i = 0; i < stringsToTranslate.length; i += batchSize) {
		batches.push(stringsToTranslate.slice(i, i + batchSize));
	}

	return batches;
}

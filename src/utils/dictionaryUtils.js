/**
 * Dictionary utilities for consistent term translation.
 *
 * Provides functionality to load user-defined translation dictionaries
 * and find matching terms in translation batches for AI context.
 *
 * @since 1.0.0
 */

import fs from 'fs';
import path from 'path';

/**
 * Loads dictionary for target language with fallback support.
 * Attempts to load language-specific dictionary first, then falls back to default.
 * Normalizes dictionary keys to lowercase for case-insensitive matching.
 *
 * @since 1.0.0
 *
 * @param {string} dictionaryDir - Directory containing dictionary files.
 * @param {string} targetLanguage - Target language code (e.g., 'fr_FR', 'es').
 * @param {Object} logger - Logger instance.
 *
 * @return {Object|null} Dictionary object with normalized lowercase keys or null if not found.
 */
export function loadDictionary(dictionaryDir, targetLanguage, logger) {
	if (!dictionaryDir || !fs.existsSync(dictionaryDir)) {
		logger.debug(`Dictionary directory not found: ${dictionaryDir}`);

		return null;
	}

	// Normalize language code for file naming (fr_FR -> fr-fr, fr -> fr.)
	const langCode = targetLanguage.toLowerCase().replace(/[_]/g, '-');

	// Try specific dictionary first (.e.g., dictionary-fr-fr.json)
	const specificDict = path.join(dictionaryDir, `dictionary-${langCode}.json`);

	// Try base language if full locale fails (.e.g., dictionary-fr.json for fr_FR)
	const baseLangCode = langCode.split('-')[0];
	const baseDict = path.join(dictionaryDir, `dictionary-${baseLangCode}.json`);

	// Fallback to default dictionary.
	const fallbackDict = path.join(dictionaryDir, 'dictionary.json');

	const candidatePaths = [specificDict, baseDict, fallbackDict].filter((filePath, index, arr) => {
		// Remove duplicates (when langCode === baseLangCode.)
		return arr.indexOf(filePath) === index;
	});

	for (const dictPath of candidatePaths) {
		try {
			if (fs.existsSync(dictPath)) {
				logger.debug(`Loading dictionary: ${dictPath}`);
				const content = fs.readFileSync(dictPath, 'utf-8');
				const dictionary = JSON.parse(content);

				if (typeof dictionary !== 'object' || dictionary === null || Array.isArray(dictionary)) {
					logger.warn(`Invalid dictionary format in ${dictPath}: expected object, got ${Array.isArray(dictionary) ? 'array' : typeof dictionary}`);
					continue;
				}

				// Normalize dictionary keys to lowercase for case-insensitive matching.
				const normalizedDictionary = {};

				for (const [source, target] of Object.entries(dictionary)) {
					if (typeof source === 'string' && typeof target === 'string') {
						const normalizedKey = source.toLowerCase();

						// Warn about potential conflicts when normalizing.
						if (normalizedDictionary[normalizedKey] && normalizedDictionary[normalizedKey] !== target) {
							logger.warn(`Dictionary key conflict: "${source}" and existing entry both normalize to "${normalizedKey}". Using: "${target}"`);
						}

						normalizedDictionary[normalizedKey] = target;
					}
				}

				logger.debug(`Successfully loaded dictionary with ${Object.keys(normalizedDictionary).length} entries (normalized to lowercase)`);

				return normalizedDictionary;
			}
		} catch (error) {
			logger.warn(`Failed to load dictionary from ${dictPath}: ${error.message}`);
		}
	}

	return null;
}

/**
 * Finds dictionary terms that appear in the current translation batch.
 * Uses case-insensitive word boundary matching with normalized lowercase dictionary keys.
 *
 * @since 1.0.0
 *
 * @param {Array} batch - Current translation batch containing msgid strings.
 * @param {Object|null} dictionary - Dictionary object with normalized lowercase keys and target mappings.
 *
 * @return {Array} Array of {source, target} dictionary matches with normalized lowercase keys.
 */
export function findDictionaryMatches(batch, dictionary) {
	if (!dictionary || !batch || batch.length === 0) {
		return [];
	}

	const matches = [];

	// Combine all msgid text for efficient searching.
	const allText = batch

		.map((item) => item.msgid || '')
		.filter((text) => text.length > 0)
		.join(' ');

	if (!allText) {
		return [];
	}

	// Convert to lowercase for matching since dictionary keys are normalized.
	const allTextLower = allText.toLowerCase();

	for (const [normalizedSource, target] of Object.entries(dictionary)) {
		if (!normalizedSource || !target || typeof normalizedSource !== 'string' || typeof target !== 'string') {
			continue; // Skip invalid entries.
		}

		// Use word boundary regex for case-insensitive matching.
		// Since dictionary keys are already lowercase, we can match directly.
		const escapedSource = normalizedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const wordBoundaryRegex = new RegExp(`\\b${escapedSource}\\b`);

		// Check if the term appears as a whole word in the lowercase text.
		if (wordBoundaryRegex.test(allTextLower)) {
			// Return the normalized dictionary key for consistent display.
			matches.push({ source: normalizedSource, target });
		}
	}

	return matches;
}

/**
 * Validates dictionary file structure and content.
 *
 * @since 1.0.0
 *
 * @param {string} dictionaryPath - Path to dictionary file.
 *
 * @return {Object} Validation result with isValid flag and errors array.
 */
export function validateDictionary(dictionaryPath) {
	const result = {
		isValid: true,
		errors: [],
		warnings: [],
		entryCount: 0,
	};

	try {
		if (!fs.existsSync(dictionaryPath)) {
			result.isValid = false;
			result.errors.push(`Dictionary file not found: ${dictionaryPath}`);

			return result;
		}

		const content = fs.readFileSync(dictionaryPath, 'utf-8');
		let dictionary;

		try {
			dictionary = JSON.parse(content);
		} catch (parseError) {
			result.isValid = false;
			result.errors.push(`Invalid JSON format: ${parseError.message}`);

			return result;
		}

		if (typeof dictionary !== 'object' || dictionary === null || Array.isArray(dictionary)) {
			result.isValid = false;
			result.errors.push('Dictionary must be a JSON object with string key-value pairs');

			return result;
		}

		// Validate entries
		let validEntryCount = 0;

		for (const [source, target] of Object.entries(dictionary)) {
			if (typeof source !== 'string' || typeof target !== 'string' || source.trim() === '' || target.trim() === '') {
				result.warnings.push(`Invalid entry: "${source}" -> "${target}" (both must be non-empty strings)`);
			} else {
				validEntryCount++;
			}
		}

		result.entryCount = validEntryCount;

		if (validEntryCount === 0) {
			result.warnings.push('Dictionary contains no valid entries');
		}

		return result;
	} catch (error) {
		result.isValid = false;
		result.errors.push(`An error occurred: ${error.message}`);

		return result;
	}
}

import fs from 'fs';
import gettextParser from 'gettext-parser';
import { getPoHeaderLocale } from './languageMapping.js';

/**
 * Comprehensive mapping of language codes to their plural forms rules.
 * Rules are primarily sourced from GlotPress (locales.php) for WordPress compatibility.
 * Supports both specific locales (e.g., fr_FR) and base languages (e.g., fr).
 *
 * @since 1.0.0
 */
const pluralFormsMap = {
	af: 'nplurals=2; plural=(n != 1);', // Afrikaans.
	ar: 'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);', // Arabic.
	az: 'nplurals=2; plural=(n != 1);', // Azerbaijani.
	bg_BG: 'nplurals=2; plural=(n != 1);', // Bulgarian.
	bn_BD: 'nplurals=2; plural=(n != 1);', // Bengali (Bangladesh.).
	ca: 'nplurals=2; plural=(n != 1);', // Catalan.
	cs_CZ: 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;', // Czech.
	cy: 'nplurals=4; plural=(n==1) ? 0 : (n==2) ? 1 : (n != 8 && n != 11) ? 2 : 3;', // Welsh.
	da_DK: 'nplurals=2; plural=(n != 1);', // Danish.
	de_DE: 'nplurals=2; plural=(n != 1);', // German (Germany.).
	de_CH: 'nplurals=2; plural=(n != 1);', // German (Switzerland.).
	el: 'nplurals=2; plural=(n != 1);', // Greek.
	en_AU: 'nplurals=2; plural=(n != 1);', // English (Australia.).
	en_CA: 'nplurals=2; plural=(n != 1);', // English (Canada.).
	en_GB: 'nplurals=2; plural=(n != 1);', // English (UK.).
	en_US: 'nplurals=2; plural=(n != 1);', // English (US.).
	en_ZA: 'nplurals=2; plural=(n != 1);', // English (South Africa.).
	eo: 'nplurals=2; plural=(n != 1);', // Esperanto.
	es_AR: 'nplurals=2; plural=(n != 1);', // Spanish (Argentina.).
	es_CL: 'nplurals=2; plural=(n != 1);', // Spanish (Chile.).
	es_CO: 'nplurals=2; plural=(n != 1);', // Spanish (Colombia.).
	es_ES: 'nplurals=2; plural=(n != 1);', // Spanish (Spain.).
	es_MX: 'nplurals=2; plural=(n != 1);', // Spanish (Mexico.).
	es_PE: 'nplurals=2; plural=(n != 1);', // Spanish (Peru.).
	es_VE: 'nplurals=2; plural=(n != 1);', // Spanish (Venezuela.).
	et: 'nplurals=2; plural=(n != 1);', // Estonian.
	eu: 'nplurals=2; plural=(n != 1);', // Basque.
	fa_IR: 'nplurals=1; plural=0;', // Persian (Iran) - GlotPress uses nplurals=2, plural=(n > 1) for 'fa', but many sources show.1. Sticking to common practice for fa_IR.
	fi: 'nplurals=2; plural=(n != 1);', // Finnish.
	fo: 'nplurals=2; plural=(n != 1);', // Faroese.
	fr_BE: 'nplurals=2; plural=(n > 1);', // French (Belgium.).
	fr_CA: 'nplurals=2; plural=(n > 1);', // French (Canada.).
	fr_FR: 'nplurals=2; plural=(n > 1);', // French (France.).
	fy: 'nplurals=2; plural=(n != 1);', // Frisian.
	ga: 'nplurals=5; plural=n==1 ? 0 : n==2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4;', // Irish.
	gd: 'nplurals=4; plural=(n==1 || n==11) ? 0 : (n==2 || n==12) ? 1 : (n > 2 && n < 20) ? 2 : 3;', // Scottish Gaelic.
	gl_ES: 'nplurals=2; plural=(n != 1);', // Galician.
	he_IL: 'nplurals=2; plural=(n != 1);', // Hebrew. GlotPress has 4; (n==1 ? 0 : n==2 ? 1 : (n<0 || n>10) && n%10==0 ? 2 : 3); for general 'he' - using simpler common one for IL.
	hi_IN: 'nplurals=2; plural=(n != 1);', // Hindi.
	hr: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', // Croatian.
	hu_HU: 'nplurals=2; plural=(n != 1);', // Hungarian.
	hy: 'nplurals=2; plural=(n != 1);', // Armenian.
	id_ID: 'nplurals=1; plural=0;', // Indonesian.
	is_IS: 'nplurals=2; plural=(n%10!=1 || n%100==11);', // Icelandic.
	it_IT: 'nplurals=2; plural=(n != 1);', // Italian.
	ja: 'nplurals=1; plural=0;', // Japanese.
	ka_GE: 'nplurals=1; plural=0;', // Georgian.
	ko_KR: 'nplurals=1; plural=0;', // Korean.
	ku: 'nplurals=2; plural=(n != 1);', // Kurdish.
	lt_LT: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2);', // Lithuanian.
	lv_LV: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n!=0 ? 1 : 2);', // Latvian.
	mk_MK: 'nplurals=2; plural=n==1 || n%10==1 ? 0 : 1;', // Macedonian.
	mn: 'nplurals=2; plural=(n != 1);', // Mongolian.
	ms_MY: 'nplurals=1; plural=0;', // Malay.
	nb_NO: 'nplurals=2; plural=(n != 1);', // Norwegian Bokmål.
	ne_NP: 'nplurals=2; plural=(n != 1);', // Nepali.
	nl_NL: 'nplurals=2; plural=(n != 1);', // Dutch (Netherlands.).
	nl_BE: 'nplurals=2; plural=(n != 1);', // Dutch (Belgium.).
	nn_NO: 'nplurals=2; plural=(n != 1);', // Norwegian Nynorsk.
	pl_PL: 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', // Polish.
	pt_BR: 'nplurals=2; plural=(n > 1);', // Portuguese (Brazil) - GlotPress uses (n!=1) for pt_BR, but (n>1) is common for Brazil.
	pt_PT: 'nplurals=2; plural=(n != 1);', // Portuguese (Portugal.).
	ro_RO: 'nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2);', // Romanian.
	ru_RU: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', // Russian.
	sk_SK: 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;', // Slovak.
	sl_SI: 'nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);', // Slovenian.
	sq_AL: 'nplurals=2; plural=(n != 1);', // Albanian.
	sr_RS: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', // Serbian.
	sv_SE: 'nplurals=2; plural=(n != 1);', // Swedish.
	th: 'nplurals=1; plural=0;', // Thai.
	tr_TR: 'nplurals=2; plural=(n > 1);', // Turkish - GlotPress has (n != 1) for tr. (n > 1) is also common.
	uk: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', // Ukrainian.
	vi: 'nplurals=1; plural=0;', // Vietnamese.
	zh_CN: 'nplurals=1; plural=0;', // Chinese (China.).
	zh_HK: 'nplurals=1; plural=0;', // Chinese (Hong Kong.).
	zh_TW: 'nplurals=1; plural=0;', // Chinese (Taiwan.).

	// Fallbacks for base languages. These are lower precedence than specific regional codes.
	en: 'nplurals=2; plural=(n != 1);',
	de: 'nplurals=2; plural=(n != 1);',
	es: 'nplurals=2; plural=(n != 1);',
	fr: 'nplurals=2; plural=(n > 1);',
	it: 'nplurals=2; plural=(n != 1);',
	pt: 'nplurals=2; plural=(n != 1);', // Defaulting to Portugal's (n != 1) for generic 'pt.'.
	nl: 'nplurals=2; plural=(n != 1);',
	ru: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
	pl: 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
	cs: 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;',
	zh: 'nplurals=1; plural=0;', // Already specific, but good as a base.
	ko: 'nplurals=1; plural=0;', // Already specific, but good as a base.
	tr: 'nplurals=2; plural=(n > 1);', // Fallback for Turkish.
};

/**
 * Default plural forms rule used as fallback when language-specific rule is not found.
 * Uses the common English plural rule: singular for 1, plural for everything else.
 *
 * @since 1.0.0
 */
const DEFAULT_PLURAL_FORMS = 'nplurals=2; plural=(n != 1);'; // A common fallback,.e.g., for English.

/**
 * Parses a POT or PO file using gettext-parser and returns the parsed data structure.
 *
 * @since 1.0.0
 *
 * @param {string} filePath - Path to the .pot or .po file to parse
 * @param {Object} logger - Logger instance for outputting messages
 *
 * @return {Object} Parsed POT/PO data structure containing translations, headers, etc.
 *
 * @throws {Error} When file cannot be read or parsed
 */
export async function parsePotFile(filePath, logger) {
	try {
		const potFileContent = fs.readFileSync(filePath, 'utf8');
		const parsedPot = gettextParser.po.parse(potFileContent);

		logger.success(`Successfully parsed .po/.pot file: ${filePath}`);

		return parsedPot;
	} catch (error) {
		logger.error(`Error reading or parsing .po/.pot file at ${filePath}:`, error);

		throw error;
	}
}

/**
 * Gets the appropriate plural forms rule for a given language code.
 * Tries specific locale first (e.g., fr_FR), then base language (e.g., fr).
 *
 * @since 1.0.0
 *
 * @param {string} languageCode - Language code like 'fr_FR', 'en_US', or 'ja'
 * @param {Object} logger - Logger instance for outputting messages
 *
 * @return {string} Plural forms rule string (e.g., 'nplurals=2; plural=(n != 1);')
 */
export function getPluralForms(languageCode, logger) {
	if (!languageCode) {
		logger.warn('No language code provided for getPluralForms, using default.');

		return DEFAULT_PLURAL_FORMS;
	}

	// Try specific locale first (.e.g., fr_FR).
	if (pluralFormsMap[languageCode]) {
		logger.debug(`Found specific plural form for ${languageCode}: ${pluralFormsMap[languageCode]}`);

		return pluralFormsMap[languageCode];
	}

	// Try base language (.e.g., fr) if specific not found.
	const baseLanguage = languageCode.split('_')[0];

	if (pluralFormsMap[baseLanguage]) {
		logger.debug(`Found base language plural form for ${languageCode} (using ${baseLanguage}): ${pluralFormsMap[baseLanguage]}`);

		return pluralFormsMap[baseLanguage];
	}

	logger.warn(`No plural form found for language code ${languageCode} or base language ${baseLanguage}. Using default: ${DEFAULT_PLURAL_FORMS}`);

	return DEFAULT_PLURAL_FORMS;
}

/**
 * Compiles parsed PO data into a .po file with proper headers and formatting.
 * Merges default headers with custom template and sets dynamic values.
 *
 * @since 1.0.0
 *
 * @param {Object} parsedPot - Parsed POT/PO data structure
 * @param {string} targetLang - Target language code (e.g., 'fr_FR', 'en_US')
 * @param {string} outputFilePath - Path where the compiled .po file will be saved
 * @param {Object} logger - Logger instance for outputting messages
 * @param {string|null} poHeaderTemplatePath - Optional path to JSON header template file
 *
 * @return {boolean} True if compilation and saving succeeded, false otherwise
 */
export async function compilePoFile(parsedPot, targetLang, outputFilePath, logger, poHeaderTemplatePath = null) {
	if (!parsedPot) {
		logger.error('Cannot compile .po file: parsed PO data is missing.');

		return false;
	}

	if (!targetLang) {
		logger.error('Cannot compile .po file: target language is missing.');

		return false;
	}

	if (!outputFilePath) {
		logger.error('Cannot compile .po file: output file path is missing.');

		return false;
	}

	const compiledPoData = { ...parsedPot };

	compiledPoData.headers = { ...(compiledPoData.headers || {}) };

	// Load and merge custom headers template.
	let customHeaders = {};

	if (poHeaderTemplatePath) {
		try {
			const templateContent = fs.readFileSync(poHeaderTemplatePath, 'utf8');

			customHeaders = JSON.parse(templateContent);

			logger.debug(`Successfully loaded custom PO header template from: ${poHeaderTemplatePath}`);
		} catch (err) {
			logger.warn(`Could not read or parse PO header template at ${poHeaderTemplatePath}. Using defaults. Error: ${err.message}`);
		}
	}

	const baseHeaders = { ...(parsedPot.headers || {}), ...customHeaders };

	// Set/update dynamic headers.
	const poRevisionDate = new Date().toISOString().slice(0, 16).replace('T', ' ') + '+0000';
	const pluralForms = getPluralForms(targetLang, logger);

	// Replace placeholders in all baseHeaders values.
	for (const key in baseHeaders) {
		if (typeof baseHeaders[key] !== 'string') {
			continue;
		}

		baseHeaders[key] = baseHeaders[key].replace(/{{LANGUAGE}}/g, targetLang);
	}

	// These are the final authoritative values for these specific headers.
	// Note: Plural-Forms is set if not already present OR if it contains placeholder values.
	const finalDynamicHeaders = {
		Language: getPoHeaderLocale(targetLang),
		'PO-Revision-Date': poRevisionDate,
	};

	// Set Plural-Forms if it's not already present OR if it contains placeholder values.
	const existingPluralForms = baseHeaders['Plural-Forms'];
	const hasPlaceholderPluralForms = !existingPluralForms || existingPluralForms.includes('INTEGER') || existingPluralForms.includes('EXPRESSION');

	if (hasPlaceholderPluralForms) {
		finalDynamicHeaders['Plural-Forms'] = pluralForms;
	}

	compiledPoData.headers = { ...baseHeaders, ...finalDynamicHeaders }; // Dynamic headers take final precedence.

	// Ensure charset is correctly set if not present or different.
	if (!compiledPoData.charset || compiledPoData.charset.toLowerCase() !== 'utf-8') {
		compiledPoData.charset = 'utf-8'; // Standardize to UTF-.8.
		logger.debug('Charset standardized to utf-8 in compiled PO data.');
	}

	try {
		const outputContent = gettextParser.po.compile(compiledPoData);

		fs.writeFileSync(outputFilePath, outputContent);

		logger.success(`Successfully compiled and saved .po file to: ${outputFilePath}`);

		return true;
	} catch (error) {
		logger.error(`Error compiling or writing .po file to ${outputFilePath}:`, error);

		return false;
	}
}

/**
 * Counts the number of untranslated strings in a parsed PO data structure.
 * A string is considered untranslated if it has no msgstr or all msgstr entries are empty.
 *
 * @since 1.0.0
 *
 * @param {Object} poData - Parsed PO data structure containing translations
 *
 * @return {number} Count of untranslated strings
 */
export function countUntranslatedStrings(poData) {
	if (!poData?.translations) {
		return 0;
	}

	let count = 0;

	for (const context of Object.values(poData.translations)) {
		if (!context || typeof context !== 'object') {
			continue;
		}

		for (const [msgid, entry] of Object.entries(context)) {
			if (msgid === '') {
				continue; // Skip header.
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

			if (needsTranslation) {
				count++;
			}
		}
	}

	return count;
}

/**
 * Counts the number of real translations in a parsed PO data structure.
 * Excludes dry run placeholders and empty translations.
 *
 * @since 1.0.0
 *
 * @param {Object} poData - Parsed PO data structure containing translations
 *
 * @return {number} Count of real translations
 */
export function countRealTranslations(poData) {
	if (!poData?.translations) {
		return 0;
	}

	let count = 0;

	for (const context of Object.values(poData.translations)) {
		if (!context || typeof context !== 'object') {
			continue;
		}

		for (const [msgid, entry] of Object.entries(context)) {
			if (msgid === '') {
				continue; // Skip header.
			}

			const msgstr = entry?.msgstr;

			// Check if it has valid translation content.
			if (!msgstr || msgstr.length === 0) {
				continue;
			}

			// Check if all msgstr entries are empty or dry run placeholders.
			const hasRealTranslation = msgstr.some((str) => {
				if (!str || str.trim() === '') {
					return false;
				}

				// Check if it's a dry run placeholder.
				if (str.startsWith('[DRY RUN]')) {
					return false;
				}

				return true;
			});

			if (hasRealTranslation) {
				count++;
			}
		}
	}

	return count;
}

/**
 * Merges existing PO data into a fresh clone of POT data.
 * Preserves valid translations from existing PO file while maintaining POT structure.
 *
 * @since 1.0.0
 *
 * @param {Object} basePotData - Base POT data structure to merge into
 * @param {Object} existingPoData - Existing PO data containing translations to preserve
 * @param {Object} localLogger - Logger instance for outputting debug messages
 * @param {string|null} targetLanguage - Target language code for proper plural forms handling
 *
 * @return {Object} Object containing outputPoData (merged result) and mergedStringsCount
 */
export function mergePoData(basePotData, existingPoData, localLogger, targetLanguage = null) {
	// localLogger might not be strictly needed if it only logs debug/info that isn't critical for this function's core logic.
	const outputPoData = JSON.parse(JSON.stringify(basePotData)); // Deep clone base. .pot data.
	let mergedStringsCount = 0;

	// Get target language plural count for proper plural forms handling.
	let targetPluralCount = 2; // Default fallback.

	if (targetLanguage) {
		const fallbackLogger = localLogger && typeof localLogger.debug === 'function' && typeof localLogger.warn === 'function' ? localLogger : { debug: () => {}, warn: () => {} };
		const pluralFormsString = getPluralForms(targetLanguage, fallbackLogger);

		targetPluralCount = extractPluralCount(pluralFormsString);
	}

	// 1. Merge Headers.
	const dynamicHeaderKeys = ['Language', 'PO-Revision-Date', 'Last-Translator', 'MIME-Version', 'Content-Transfer-Encoding'];

	if (existingPoData.headers) {
		outputPoData.headers = outputPoData.headers || {};

		for (const key in existingPoData.headers) {
			// If the header is one of the dynamic ones, and the base POT data already has a version of it (.e.g., POT-Creation-Date),
			// we might prefer the base one or let compilePoFile handle it.
			// For non-dynamic headers, or dynamic ones not in base, take from existing.
			// The main goal is to preserve user-defined headers from the existing. .po file.
			// compilePoFile will have the final say on essential dynamic headers like Language, Plural-Forms.
			if (dynamicHeaderKeys.includes(key)) {
				// If it's a dynamic header, only preserve it if it's not already in the base POT data.
				if (!basePotData.headers || !basePotData.headers[key]) {
					outputPoData.headers[key] = existingPoData.headers[key];
				}
				// Otherwise, let compilePoFile handle the final value.
			} else {
				// Not a dynamic key, so preserve from existing. .po file.
				outputPoData.headers[key] = existingPoData.headers[key];
			}
		}
	}

	// 2. Merge Translations.
	for (const context of Object.keys(outputPoData.translations)) {
		if (!outputPoData.translations[context]) {
			continue;
		}

		for (const msgid of Object.keys(outputPoData.translations[context])) {
			if (msgid === '') {
				continue; // Skip POT header entry.
			}

			const potEntry = outputPoData.translations[context][msgid];
			const existingEntry = existingPoData.translations && existingPoData.translations[context] && existingPoData.translations[context][msgid];

			// Skip if no existing entry or no valid translation.
			if (!existingEntry || !existingEntry.msgstr || existingEntry.msgstr.length === 0 || !existingEntry.msgstr[0]) {
				continue;
			}

			// Handle plural forms correctly.
			if (potEntry.msgid_plural) {
				// This is a plural entry - ensure we maintain the correct number of forms.
				const existingMsgstr = existingEntry.msgstr;
				const newMsgstr = new Array(targetPluralCount).fill('');

				// Copy existing translations up to the target plural count.
				for (let i = 0; i < Math.min(existingMsgstr.length, targetPluralCount); i++) {
					if (existingMsgstr[i] && existingMsgstr[i].trim() !== '') {
						newMsgstr[i] = existingMsgstr[i];
					}
				}

				// Only merge if we have at least one valid translation.
				const hasValidTranslation = newMsgstr.some((str) => str && str.trim() !== '');

				if (hasValidTranslation) {
					potEntry.msgstr = newMsgstr;
					mergedStringsCount++;

					if (localLogger && typeof localLogger.debug === 'function') {
						localLogger.debug(`Merged plural entry "${msgid}" with ${targetPluralCount} forms (${existingMsgstr.length} existing forms)`);
					}
				}
			} else {
				// Regular (non-plural) entry.
				potEntry.msgstr = existingEntry.msgstr;
				mergedStringsCount++;
			}

			if (existingEntry.comments && existingEntry.comments.flag === 'fuzzy') {
				potEntry.comments = { ...(potEntry.comments || {}), flag: 'fuzzy' };
			} else if (potEntry.comments && potEntry.comments.flag === 'fuzzy') {
				delete potEntry.comments.flag;

				if (Object.keys(potEntry.comments).length === 0) {
					delete potEntry.comments;
				}
			}
		}
	}

	if (localLogger && typeof localLogger.debug === 'function') {
		// Check if logger and debug method exist.
		localLogger.debug(`mergePoData: Merged ${mergedStringsCount} strings. Header merge strategy applied.`);
	}

	return { outputPoData, mergedStringsCount };
}

/**
 * Extracts the number of plural forms from a plural forms string.
 *
 * @since 1.0.0
 *
 * @param {string} pluralFormsString - Plural forms string (e.g., 'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);')
 *
 * @return {number} Number of plural forms (defaults to 2 if parsing fails)
 */
export function extractPluralCount(pluralFormsString) {
	if (!pluralFormsString) {
		return 2;
	}

	const match = pluralFormsString.match(/nplurals\s*=\s*(\d+)/);

	return match ? parseInt(match[1], 10) : 2;
}

/**
 * Initializes plural entries in PO data with the correct number of msgstr entries for the target language.
 * This ensures that plural forms have the right number of empty slots for translation.
 *
 * @since 1.0.0
 *
 * @param {Object} poData - Parsed PO data structure
 * @param {string} targetLanguage - Target language code (e.g., 'ar', 'pl_PL')
 * @param {Object} logger - Logger instance for outputting messages
 *
 * @return {Object} Updated PO data with correctly initialized plural forms
 */
export function initializePluralForms(poData, targetLanguage, logger) {
	const pluralFormsString = getPluralForms(targetLanguage, logger);
	const pluralCount = extractPluralCount(pluralFormsString);

	logger.debug(`Initializing plural forms for ${targetLanguage}: ${pluralCount} forms`);

	// Deep clone to avoid modifying the original.
	const updatedPoData = JSON.parse(JSON.stringify(poData));

	// Update headers with correct plural forms.
	if (!updatedPoData.headers) {
		updatedPoData.headers = {};
	}
	updatedPoData.headers['Plural-Forms'] = pluralFormsString;

	// Initialize plural entries with correct number of msgstr entries.
	for (const contextKey in updatedPoData.translations) {
		const context = updatedPoData.translations[contextKey];

		for (const msgid in context) {
			const entry = context[msgid];

			// Skip header entry.
			if (msgid === '') {
				continue;
			}

			// Check if this is a plural entry.
			if (entry.msgid_plural) {
				// Initialize with the correct number of empty strings.
				entry.msgstr = new Array(pluralCount).fill('');
				logger.debug(`Initialized plural entry "${msgid}" with ${pluralCount} forms`);
			}
		}
	}

	return updatedPoData;
}

/**
 * Export constants for external use in other modules.
 *
 * @since 1.0.0
 */
export { pluralFormsMap, DEFAULT_PLURAL_FORMS };

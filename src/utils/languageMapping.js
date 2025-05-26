/**
 * Language Mapping Utility.
 *
 * Comprehensive mapping of language codes and locales to English language names.
 * Based on GlotPress locales data from WordPress.org translation platform.
 *
 * Supports multiple formats:
 * - WordPress locales (zh_CN, fr_FR, ru_RU)
 * - ISO 639-1 codes (zh, fr, ru)
 * - BCP 47 style (zh-CN, fr-FR, ru-RU)
 * - GlotPress slugs (zh-cn, fr-fr, ru-ru)
 *
 * Source: https:// raw.githubusercontent.com/GlotPress/GlotPress/refs/heads/develop/locales/locales.php
 *
 * @since 1.0.0
 */

/**
 * Primary language mapping from various locale formats to English names.
 * This is the comprehensive mapping extracted from GlotPress locales data.
 * Supports multiple locale code formats including WordPress (underscore), BCP 47 (dash),
 * ISO 639-1/639-2 codes, and GlotPress slug formats.
 *
 * @since 1.0.0
 *
 * @type {Object.<string, string>}
 */
const LANGUAGE_MAPPING = {
	// Afrikaans
	af: 'Afrikaans',
	af_ZA: 'Afrikaans',
	'af-za': 'Afrikaans',
	afr: 'Afrikaans',

	// Akan
	ak: 'Akan',
	ak_GH: 'Akan',
	'ak-gh': 'Akan',
	aka: 'Akan',

	// Amharic
	am: 'Amharic',
	am_ET: 'Amharic',
	'am-et': 'Amharic',
	amh: 'Amharic',

	// Arabic
	ar: 'Arabic',
	ar_AR: 'Arabic',
	'ar-ar': 'Arabic',
	ara: 'Arabic',
	arq: 'Algerian Arabic',
	ary: 'Moroccan Arabic',

	// Assamese
	as: 'Assamese',
	asm: 'Assamese',

	// Azerbaijani
	az: 'Azerbaijani',
	az_AZ: 'Azerbaijani',
	'az-az': 'Azerbaijani',
	aze: 'Azerbaijani',

	// Bashkir
	ba: 'Bashkir',
	bak: 'Bashkir',

	// Belarusian
	be: 'Belarusian',
	be_BY: 'Belarusian',
	'be-by': 'Belarusian',
	bel: 'Belarusian',

	// Bulgarian
	bg: 'Bulgarian',
	bg_BG: 'Bulgarian',
	'bg-bg': 'Bulgarian',
	bul: 'Bulgarian',

	// Bengali
	bn: 'Bengali',
	bn_BD: 'Bengali (Bangladesh)',
	'bn-bd': 'Bengali (Bangladesh)',
	bn_IN: 'Bengali (India)',
	'bn-in': 'Bengali (India)',
	ben: 'Bengali',

	// Tibetan
	bo: 'Tibetan',
	bod: 'Tibetan',
	tib: 'Tibetan',

	// Breton
	br: 'Breton',
	bre: 'Breton',

	// Bosnian
	bs: 'Bosnian',
	bs_BA: 'Bosnian',
	'bs-ba': 'Bosnian',
	bos: 'Bosnian',

	// Catalan
	ca: 'Catalan',
	ca_ES: 'Catalan',
	'ca-es': 'Catalan',
	cat: 'Catalan',

	// Cherokee
	chr: 'Cherokee',

	// Corsican
	co: 'Corsican',
	cos: 'Corsican',

	// Czech
	cs: 'Czech',
	cs_CZ: 'Czech',
	'cs-cz': 'Czech',
	ces: 'Czech',
	cze: 'Czech',

	// Welsh
	cy: 'Welsh',
	cy_GB: 'Welsh',
	'cy-gb': 'Welsh',
	cym: 'Welsh',
	wel: 'Welsh',

	// Danish
	da: 'Danish',
	da_DK: 'Danish',
	'da-dk': 'Danish',
	dan: 'Danish',

	// German
	de: 'German',
	de_DE: 'German',
	'de-de': 'German',
	de_AT: 'German (Austria)',
	'de-at': 'German (Austria)',
	de_CH: 'German (Switzerland)',
	'de-ch': 'German (Switzerland)',
	deu: 'German',
	ger: 'German',

	// Greek
	el: 'Greek',
	el_GR: 'Greek',
	'el-gr': 'Greek',
	ell: 'Greek',
	gre: 'Greek',

	// English
	en: 'English',
	en_US: 'English (US)',
	'en-us': 'English (US)',
	en_GB: 'English (UK)',
	'en-gb': 'English (UK)',
	en_AU: 'English (Australia)',
	'en-au': 'English (Australia)',
	en_CA: 'English (Canada)',
	'en-ca': 'English (Canada)',
	en_NZ: 'English (New Zealand)',
	'en-nz': 'English (New Zealand)',
	en_ZA: 'English (South Africa)',
	'en-za': 'English (South Africa)',
	eng: 'English',

	// Esperanto
	eo: 'Esperanto',
	epo: 'Esperanto',

	// Spanish
	es: 'Spanish',
	es_ES: 'Spanish (Spain)',
	'es-es': 'Spanish (Spain)',
	es_MX: 'Spanish (Mexico)',
	'es-mx': 'Spanish (Mexico)',
	es_AR: 'Spanish (Argentina)',
	'es-ar': 'Spanish (Argentina)',
	es_CL: 'Spanish (Chile)',
	'es-cl': 'Spanish (Chile)',
	es_CO: 'Spanish (Colombia)',
	'es-co': 'Spanish (Colombia)',
	es_PE: 'Spanish (Peru)',
	'es-pe': 'Spanish (Peru)',
	es_VE: 'Spanish (Venezuela)',
	'es-ve': 'Spanish (Venezuela)',
	spa: 'Spanish',

	// Estonian
	et: 'Estonian',
	et_EE: 'Estonian',
	'et-ee': 'Estonian',
	est: 'Estonian',

	// Basque
	eu: 'Basque',
	eu_ES: 'Basque',
	'eu-es': 'Basque',
	eus: 'Basque',
	baq: 'Basque',

	// Persian/Farsi
	fa: 'Persian',
	fa_IR: 'Persian',
	'fa-ir': 'Persian',
	fas: 'Persian',
	per: 'Persian',

	// Finnish
	fi: 'Finnish',
	fi_FI: 'Finnish',
	'fi-fi': 'Finnish',
	fin: 'Finnish',

	// French
	fr: 'French',
	fr_FR: 'French (France)',
	'fr-fr': 'French (France)',
	fr_CA: 'French (Canada)',
	'fr-ca': 'French (Canada)',
	fr_BE: 'French (Belgium)',
	'fr-be': 'French (Belgium)',
	fr_CH: 'French (Switzerland)',
	'fr-ch': 'French (Switzerland)',
	fra: 'French',
	fre: 'French',

	// Western Frisian
	fy: 'Western Frisian',
	fy_NL: 'Western Frisian',
	'fy-nl': 'Western Frisian',
	fry: 'Western Frisian',

	// Irish
	ga: 'Irish',
	ga_IE: 'Irish',
	'ga-ie': 'Irish',
	gle: 'Irish',

	// Scottish Gaelic
	gd: 'Scottish Gaelic',
	gd_GB: 'Scottish Gaelic',
	'gd-gb': 'Scottish Gaelic',
	gla: 'Scottish Gaelic',

	// Galician
	gl: 'Galician',
	gl_ES: 'Galician',
	'gl-es': 'Galician',
	glg: 'Galician',

	// Gujarati
	gu: 'Gujarati',
	gu_IN: 'Gujarati',
	'gu-in': 'Gujarati',
	guj: 'Gujarati',

	// Hebrew
	he: 'Hebrew',
	he_IL: 'Hebrew',
	'he-il': 'Hebrew',
	heb: 'Hebrew',
	iw: 'Hebrew', // Legacy code.

	// Hindi
	hi: 'Hindi',
	hi_IN: 'Hindi',
	'hi-in': 'Hindi',
	hin: 'Hindi',

	// Croatian
	hr: 'Croatian',
	hr_HR: 'Croatian',
	'hr-hr': 'Croatian',
	hrv: 'Croatian',

	// Hungarian
	hu: 'Hungarian',
	hu_HU: 'Hungarian',
	'hu-hu': 'Hungarian',
	hun: 'Hungarian',

	// Armenian
	hy: 'Armenian',
	hy_AM: 'Armenian',
	'hy-am': 'Armenian',
	hye: 'Armenian',
	arm: 'Armenian',

	// Indonesian
	id: 'Indonesian',
	id_ID: 'Indonesian',
	'id-id': 'Indonesian',
	ind: 'Indonesian',

	// Icelandic
	is: 'Icelandic',
	is_IS: 'Icelandic',
	'is-is': 'Icelandic',
	isl: 'Icelandic',
	ice: 'Icelandic',

	// Italian
	it: 'Italian',
	it_IT: 'Italian',
	'it-it': 'Italian',
	ita: 'Italian',

	// Japanese
	ja: 'Japanese',
	ja_JP: 'Japanese',
	'ja-jp': 'Japanese',
	jpn: 'Japanese',

	// Georgian
	ka: 'Georgian',
	ka_GE: 'Georgian',
	'ka-ge': 'Georgian',
	kat: 'Georgian',
	geo: 'Georgian',

	// Kazakh
	kk: 'Kazakh',
	kk_KZ: 'Kazakh',
	'kk-kz': 'Kazakh',
	kaz: 'Kazakh',

	// Khmer
	km: 'Khmer',
	km_KH: 'Khmer',
	'km-kh': 'Khmer',
	khm: 'Khmer',

	// Kannada
	kn: 'Kannada',
	kn_IN: 'Kannada',
	'kn-in': 'Kannada',
	kan: 'Kannada',

	// Korean
	ko: 'Korean',
	ko_KR: 'Korean',
	'ko-kr': 'Korean',
	kor: 'Korean',

	// Kurdish
	ku: 'Kurdish',
	kur: 'Kurdish',

	// Kyrgyz
	ky: 'Kyrgyz',
	ky_KG: 'Kyrgyz',
	'ky-kg': 'Kyrgyz',
	kir: 'Kyrgyz',

	// Latin
	la: 'Latin',
	lat: 'Latin',

	// Luxembourgish
	lb: 'Luxembourgish',
	lb_LU: 'Luxembourgish',
	'lb-lu': 'Luxembourgish',
	ltz: 'Luxembourgish',

	// Lao
	lo: 'Lao',
	lo_LA: 'Lao',
	'lo-la': 'Lao',
	lao: 'Lao',

	// Lithuanian
	lt: 'Lithuanian',
	lt_LT: 'Lithuanian',
	'lt-lt': 'Lithuanian',
	lit: 'Lithuanian',

	// Latvian
	lv: 'Latvian',
	lv_LV: 'Latvian',
	'lv-lv': 'Latvian',
	lav: 'Latvian',

	// Malagasy
	mg: 'Malagasy',
	mg_MG: 'Malagasy',
	'mg-mg': 'Malagasy',
	mlg: 'Malagasy',

	// Macedonian
	mk: 'Macedonian',
	mk_MK: 'Macedonian',
	'mk-mk': 'Macedonian',
	mkd: 'Macedonian',
	mac: 'Macedonian',

	// Malayalam
	ml: 'Malayalam',
	ml_IN: 'Malayalam',
	'ml-in': 'Malayalam',
	mal: 'Malayalam',

	// Mongolian
	mn: 'Mongolian',
	mn_MN: 'Mongolian',
	'mn-mn': 'Mongolian',
	mon: 'Mongolian',

	// Marathi
	mr: 'Marathi',
	mr_IN: 'Marathi',
	'mr-in': 'Marathi',
	mar: 'Marathi',

	// Malay
	ms: 'Malay',
	ms_MY: 'Malay',
	'ms-my': 'Malay',
	msa: 'Malay',
	may: 'Malay',

	// Maltese
	mt: 'Maltese',
	mt_MT: 'Maltese',
	'mt-mt': 'Maltese',
	mlt: 'Maltese',

	// Burmese
	my: 'Burmese',
	my_MM: 'Burmese',
	'my-mm': 'Burmese',
	mya: 'Burmese',
	bur: 'Burmese',

	// Norwegian (Bokmål)
	nb: 'Norwegian (Bokmål)',
	nb_NO: 'Norwegian (Bokmål)',
	'nb-no': 'Norwegian (Bokmål)',
	nob: 'Norwegian (Bokmål)',

	// Nepali
	ne: 'Nepali',
	ne_NP: 'Nepali',
	'ne-np': 'Nepali',
	nep: 'Nepali',

	// Dutch
	nl: 'Dutch',
	nl_NL: 'Dutch',
	'nl-nl': 'Dutch',
	nl_BE: 'Dutch (Belgium)',
	'nl-be': 'Dutch (Belgium)',
	nld: 'Dutch',
	dut: 'Dutch',

	// Norwegian (Nynorsk)
	nn: 'Norwegian (Nynorsk)',
	nn_NO: 'Norwegian (Nynorsk)',
	'nn-no': 'Norwegian (Nynorsk)',
	nno: 'Norwegian (Nynorsk)',

	// Norwegian (generic)
	no: 'Norwegian',
	no_NO: 'Norwegian',
	'no-no': 'Norwegian',
	nor: 'Norwegian',

	// Occitan
	oc: 'Occitan',
	oci: 'Occitan',

	// Oriya
	or: 'Oriya',
	or_IN: 'Oriya',
	'or-in': 'Oriya',
	ori: 'Oriya',

	// Punjabi
	pa: 'Punjabi',
	pa_IN: 'Punjabi',
	'pa-in': 'Punjabi',
	pan: 'Punjabi',

	// Polish
	pl: 'Polish',
	pl_PL: 'Polish',
	'pl-pl': 'Polish',
	pol: 'Polish',

	// Portuguese
	pt: 'Portuguese',
	pt_PT: 'Portuguese (Portugal)',
	'pt-pt': 'Portuguese (Portugal)',
	pt_BR: 'Portuguese (Brazil)',
	'pt-br': 'Portuguese (Brazil)',
	por: 'Portuguese',

	// Romanian
	ro: 'Romanian',
	ro_RO: 'Romanian',
	'ro-ro': 'Romanian',
	ron: 'Romanian',
	rum: 'Romanian',

	// Russian
	ru: 'Russian',
	ru_RU: 'Russian',
	'ru-ru': 'Russian',
	rus: 'Russian',

	// Sanskrit
	sa: 'Sanskrit',
	sa_IN: 'Sanskrit',
	'sa-in': 'Sanskrit',
	san: 'Sanskrit',

	// Sindhi
	sd: 'Sindhi',
	sd_PK: 'Sindhi',
	'sd-pk': 'Sindhi',
	snd: 'Sindhi',

	// Slovak
	sk: 'Slovak',
	sk_SK: 'Slovak',
	'sk-sk': 'Slovak',
	slk: 'Slovak',
	slo: 'Slovak',

	// Slovenian
	sl: 'Slovenian',
	sl_SI: 'Slovenian',
	'sl-si': 'Slovenian',
	slv: 'Slovenian',

	// Albanian
	sq: 'Albanian',
	sq_AL: 'Albanian',
	'sq-al': 'Albanian',
	sqi: 'Albanian',
	alb: 'Albanian',

	// Serbian
	sr: 'Serbian',
	sr_RS: 'Serbian',
	'sr-rs': 'Serbian',
	srp: 'Serbian',

	// Swedish
	sv: 'Swedish',
	sv_SE: 'Swedish',
	'sv-se': 'Swedish',
	swe: 'Swedish',

	// Swahili
	sw: 'Swahili',
	sw_KE: 'Swahili',
	'sw-ke': 'Swahili',
	swa: 'Swahili',

	// Tamil
	ta: 'Tamil',
	ta_IN: 'Tamil',
	'ta-in': 'Tamil',
	ta_LK: 'Tamil (Sri Lanka)',
	'ta-lk': 'Tamil (Sri Lanka)',
	tam: 'Tamil',

	// Telugu
	te: 'Telugu',
	te_IN: 'Telugu',
	'te-in': 'Telugu',
	tel: 'Telugu',

	// Tajik
	tg: 'Tajik',
	tg_TJ: 'Tajik',
	'tg-tj': 'Tajik',
	tgk: 'Tajik',

	// Thai
	th: 'Thai',
	th_TH: 'Thai',
	'th-th': 'Thai',
	tha: 'Thai',

	// Turkish
	tr: 'Turkish',
	tr_TR: 'Turkish',
	'tr-tr': 'Turkish',
	tur: 'Turkish',

	// Ukrainian
	uk: 'Ukrainian',
	uk_UA: 'Ukrainian',
	'uk-ua': 'Ukrainian',
	ukr: 'Ukrainian',

	// Urdu
	ur: 'Urdu',
	ur_PK: 'Urdu',
	'ur-pk': 'Urdu',
	urd: 'Urdu',

	// Uzbek
	uz: 'Uzbek',
	uz_UZ: 'Uzbek',
	'uz-uz': 'Uzbek',
	uzb: 'Uzbek',

	// Vietnamese
	vi: 'Vietnamese',
	vi_VN: 'Vietnamese',
	'vi-vn': 'Vietnamese',
	vie: 'Vietnamese',

	// Yiddish
	yi: 'Yiddish',
	yid: 'Yiddish',

	// Yoruba
	yo: 'Yoruba',
	yo_NG: 'Yoruba',
	'yo-ng': 'Yoruba',
	yor: 'Yoruba',

	// Chinese
	zh: 'Chinese',
	zh_CN: 'Chinese (Simplified)',
	'zh-cn': 'Chinese (Simplified)',
	zh_TW: 'Chinese (Traditional)',
	'zh-tw': 'Chinese (Traditional)',
	zh_HK: 'Chinese (Hong Kong)',
	'zh-hk': 'Chinese (Hong Kong)',
	zh_SG: 'Chinese (Singapore)',
	'zh-sg': 'Chinese (Singapore)',
	zho: 'Chinese',
	chi: 'Chinese',

	// Zulu
	zu: 'Zulu',
	zu_ZA: 'Zulu',
	'zu-za': 'Zulu',
	zul: 'Zulu',

	// Tamazight
	zgh: 'Tamazight',

	// Mingrelian
	xmf: 'Mingrelian',
};

/**
 * Default locale mappings for languages that don't have a specific region.
 * Used when converting from language names or base codes to full locales.
 *
 * @since 1.0.0
 *
 * @type {Object.<string, string>}
 */
const DEFAULT_LOCALE_MAPPING = {
	af: 'af_ZA',
	ar: 'ar_AR',
	az: 'az_AZ',
	be: 'be_BY',
	bg: 'bg_BG',
	bn: 'bn_BD',
	bs: 'bs_BA',
	ca: 'ca_ES',
	cs: 'cs_CZ',
	cy: 'cy_GB',
	da: 'da_DK',
	de: 'de_DE',
	el: 'el_GR',
	en: 'en_US',
	es: 'es_ES',
	et: 'et_EE',
	eu: 'eu_ES',
	fa: 'fa_IR',
	fi: 'fi_FI',
	fr: 'fr_FR',
	fy: 'fy_NL',
	ga: 'ga_IE',
	gd: 'gd_GB',
	gl: 'gl_ES',
	gu: 'gu_IN',
	he: 'he_IL',
	hi: 'hi_IN',
	hr: 'hr_HR',
	hu: 'hu_HU',
	hy: 'hy_AM',
	id: 'id_ID',
	is: 'is_IS',
	it: 'it_IT',
	ja: 'ja_JP',
	ka: 'ka_GE',
	kk: 'kk_KZ',
	km: 'km_KH',
	kn: 'kn_IN',
	ko: 'ko_KR',
	ky: 'ky_KG',
	lb: 'lb_LU',
	lo: 'lo_LA',
	lt: 'lt_LT',
	lv: 'lv_LV',
	mg: 'mg_MG',
	mk: 'mk_MK',
	ml: 'ml_IN',
	mn: 'mn_MN',
	mr: 'mr_IN',
	ms: 'ms_MY',
	mt: 'mt_MT',
	my: 'my_MM',
	nb: 'nb_NO',
	ne: 'ne_NP',
	nl: 'nl_NL',
	nn: 'nn_NO',
	no: 'no_NO',
	or: 'or_IN',
	pa: 'pa_IN',
	pl: 'pl_PL',
	pt: 'pt_PT',
	ro: 'ro_RO',
	ru: 'ru_RU',
	sa: 'sa_IN',
	sd: 'sd_PK',
	sk: 'sk_SK',
	sl: 'sl_SI',
	sq: 'sq_AL',
	sr: 'sr_RS',
	sv: 'sv_SE',
	sw: 'sw_KE',
	ta: 'ta_IN',
	te: 'te_IN',
	tg: 'tg_TJ',
	th: 'th_TH',
	tr: 'tr_TR',
	uk: 'uk_UA',
	ur: 'ur_PK',
	uz: 'uz_UZ',
	vi: 'vi_VN',
	yo: 'yo_NG',
	zh: 'zh_CN',
	zu: 'zu_ZA',
};

/**
 * Gets the English language name for a given locale code.
 *
 * Handles multiple locale formats and normalizes them:
 * - WordPress format: ru_RU, zh_CN, fr_FR
 * - BCP 47 format: ru-RU, zh-CN, fr-FR
 * - ISO codes: ru, zh, fr
 * - GlotPress slugs: ru-ru, zh-cn, fr-fr
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to look up
 * @return {string} English language name, or the original code if not found
 */
export function getLanguageName(localeCode) {
	if (!localeCode || typeof localeCode !== 'string') {
		return localeCode;
	}

	// Try exact match first.
	const exactMatch = LANGUAGE_MAPPING[localeCode];

	if (exactMatch) {
		return exactMatch;
	}

	// Normalize and try common variations.
	const normalizedCode = localeCode.toLowerCase();

	// Try normalized version.
	const normalizedMatch = LANGUAGE_MAPPING[normalizedCode];

	if (normalizedMatch) {
		return normalizedMatch;
	}

	// Try converting between underscore and dash formats.
	const alternateFormat = normalizedCode.includes('_') ? normalizedCode.replace('_', '-') : normalizedCode.replace('-', '_');
	const alternateMatch = LANGUAGE_MAPPING[alternateFormat];

	if (alternateMatch) {
		return alternateMatch;
	}

	// Try just the language part (before _ or -.).
	const langOnly = normalizedCode.split(/[_-]/)[0];
	const langOnlyMatch = LANGUAGE_MAPPING[langOnly];

	if (langOnlyMatch) {
		return langOnlyMatch;
	}

	// Return original code if no match found.
	return localeCode;
}

/**
 * Checks if a locale code is supported in our language mapping.
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to check
 * @return {boolean} True if the locale is supported
 */
export function isLocaleSupported(localeCode) {
	return getLanguageName(localeCode) !== localeCode;
}

/**
 * Gets all supported locale codes.
 *
 * @since 1.0.0
 *
 * @return {Array<string>} Array of supported locale codes
 */
export function getSupportedLocales() {
	return Object.keys(LANGUAGE_MAPPING);
}

/**
 * Gets WordPress-specific locale mappings.
 *
 * @since 1.0.0
 *
 * @return {Object} WordPress locale mapping object
 */
export function getWordPressLocaleMapping() {
	const wpMapping = {};

	for (const [code, name] of Object.entries(LANGUAGE_MAPPING)) {
		if (code.includes('_')) {
			wpMapping[code] = name;
		}
	}

	return wpMapping;
}

/**
 * Normalizes a user-provided language input to a standard locale code.
 * Handles various input formats like "Russian", "ru", "ru_RU" and returns
 * the most appropriate locale code.
 *
 * @since 1.0.0
 *
 * @param {string} userInput - User-provided language input
 * @return {string} Normalized locale code (e.g., "ru_RU" for "Russian")
 */
export function normalizeLanguageInput(userInput) {
	if (!userInput || typeof userInput !== 'string') {
		return userInput;
	}

	const input = userInput.trim();

	// If it's already a valid locale code, return it.
	if (LANGUAGE_MAPPING[input]) {
		return input;
	}

	// Try case-insensitive lookup.
	const lowerInput = input.toLowerCase();

	if (LANGUAGE_MAPPING[lowerInput]) {
		return lowerInput;
	}

	// Try converting between underscore and dash formats.
	const alternateFormat = lowerInput.includes('_') ? lowerInput.replace('_', '-') : lowerInput.replace('-', '_');

	if (LANGUAGE_MAPPING[alternateFormat]) {
		return alternateFormat;
	}

	// Try to find by language name (case-insensitive.).
	const inputLower = input.toLowerCase();

	for (const [code, name] of Object.entries(LANGUAGE_MAPPING)) {
		if (name.toLowerCase() === inputLower) {
			// Prefer full locale codes (with underscore) over base language codes.
			const fullLocaleCode = Object.keys(LANGUAGE_MAPPING).find((key) => key.includes('_') && LANGUAGE_MAPPING[key] === name);

			return fullLocaleCode || code;
		}
	}

	// Try partial matches for language names.
	for (const [code, name] of Object.entries(LANGUAGE_MAPPING)) {
		if (name.toLowerCase().includes(inputLower) || inputLower.includes(name.toLowerCase())) {
			const fullLocaleCode = Object.keys(LANGUAGE_MAPPING).find((key) => key.includes('_') && LANGUAGE_MAPPING[key] === name);

			return fullLocaleCode || code;
		}
	}

	// If no match found, try to construct a reasonable default.
	// If it looks like a base language code, try to find a default locale.
	if (/^[a-z]{2}$/i.test(input)) {
		const defaultLocale = DEFAULT_LOCALE_MAPPING[input.toLowerCase()];

		if (defaultLocale) {
			return defaultLocale;
		}
	}

	// If no match found, return the original input.
	return input;
}

/**
 * Converts a locale code to different format types.
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to convert
 * @param {string} format - The desired format: 'wp_locale', 'iso_639_1', 'iso_639_2', 'target_lang'
 * @return {string} Converted locale code
 */
export function convertLocaleFormat(localeCode, format = 'target_lang') {
	if (!localeCode || typeof localeCode !== 'string') {
		return localeCode;
	}

	// Normalize the input first.
	const normalizedCode = normalizeLanguageInput(localeCode);

	// ISO 639-2 mapping for 3-letter language codes.
	const iso639TwoMap = {
		ru: 'rus',
		fr: 'fra',
		en: 'eng',
		de: 'deu',
		es: 'spa',
		it: 'ita',
		pt: 'por',
		zh: 'zho',
		ja: 'jpn',
		ko: 'kor',
		ar: 'ara',
		hi: 'hin',
		th: 'tha',
		vi: 'vie',
		tr: 'tur',
		pl: 'pol',
		nl: 'nld',
		sv: 'swe',
		da: 'dan',
		no: 'nor',
		fi: 'fin',
		hu: 'hun',
		cs: 'ces',
		sk: 'slk',
		sl: 'slv',
		hr: 'hrv',
		sr: 'srp',
		bg: 'bul',
		ro: 'ron',
		uk: 'ukr',
		be: 'bel',
		lt: 'lit',
		lv: 'lav',
		et: 'est',
		mt: 'mlt',
		ga: 'gle',
		cy: 'cym',
		is: 'isl',
		mk: 'mkd',
		sq: 'sqi',
		eu: 'eus',
		ca: 'cat',
		gl: 'glg',
		he: 'heb',
		fa: 'fas',
		ur: 'urd',
		bn: 'ben',
		ta: 'tam',
		te: 'tel',
		ml: 'mal',
		kn: 'kan',
		gu: 'guj',
		pa: 'pan',
		or: 'ori',
		as: 'asm',
		ne: 'nep',
		si: 'sin',
		my: 'mya',
		km: 'khm',
		lo: 'lao',
		ka: 'kat',
		hy: 'hye',
		az: 'aze',
		kk: 'kaz',
		ky: 'kir',
		uz: 'uzb',
		tg: 'tgk',
		mn: 'mon',
		bo: 'bod',
		dz: 'dzo',
		am: 'amh',
		ti: 'tir',
		om: 'orm',
		so: 'som',
		sw: 'swa',
		rw: 'kin',
		rn: 'run',
		ny: 'nya',
		mg: 'mlg',
		zu: 'zul',
		xh: 'xho',
		af: 'afr',
		st: 'sot',
		tn: 'tsn',
		ss: 'ssw',
		ve: 'ven',
		ts: 'tso',
		nr: 'nbl',
	};

	switch (format) {
		case 'wp_locale': {
			// WordPress format: ru_RU, fr_FR, en_US.
			// If we have a full locale, use it; otherwise try to find one.
			if (normalizedCode.includes('_')) {
				return normalizedCode;
			}
			// Try to find a full locale for this language.
			const wpLocale = Object.keys(LANGUAGE_MAPPING).find((key) => key.includes('_') && key.startsWith(normalizedCode + '_'));

			return wpLocale || normalizedCode + '_' + normalizedCode.toUpperCase();
		}

		case 'iso_639_1': {
			// ISO 639-1: ru, fr, en (2-letter language codes.)
			return normalizedCode.split(/[_-]/)[0];
		}

		case 'iso_639_2': {
			// ISO 639-2: rus, fra, eng (3-letter language codes.)
			// This is a simplified mapping - in practice you'd need a full ISO 639-2 table.
			const langCode = normalizedCode.split(/[_-]/)[0];

			return iso639TwoMap[langCode] || langCode;
		}

		case 'target_lang':
		default:
			// Default format: keep as-is (ru_RU, fr_FR, etc.)
			return normalizedCode;
	}
}

/**
 * Gets the appropriate locale code for PO file headers.
 * This should be a BCP-47/RFC 5646 compliant code.
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to convert
 * @return {string} BCP-47 compliant locale code for PO headers
 */
export function getPoHeaderLocale(localeCode) {
	const normalized = normalizeLanguageInput(localeCode);

	// Convert underscore to dash for BCP-47 compliance.
	return normalized.replace(/_/g, '-');
}

/**
 * Gets the appropriate locale code for file naming based on the specified format.
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to convert
 * @param {string} format - The desired format: 'wp_locale', 'iso_639_1', 'iso_639_2', 'target_lang'
 * @return {string} Locale code for file naming
 */
export function getFileNamingLocale(localeCode, format = 'target_lang') {
	return convertLocaleFormat(localeCode, format);
}

/**
 * Gets the appropriate language name for API translation requests.
 * Returns the English language name which is more descriptive for AI models.
 *
 * @since 1.0.0
 *
 * @param {string} localeCode - The locale code to convert
 * @return {string} English language name for API requests
 */
export function getApiTargetLanguage(localeCode) {
	// First normalize the input to get a proper locale code.
	const normalizedCode = normalizeLanguageInput(localeCode);

	// Then get the language name for that normalized code.
	return getLanguageName(normalizedCode);
}

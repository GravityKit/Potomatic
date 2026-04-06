/**
 * Tests for normalizeNbsp in xmlTranslation.js.
 *
 * Verifies that non-breaking spaces (U+00A0) produced by the LLM are
 * normalized to regular spaces only in leading/trailing whitespace,
 * preserving intentional interior nbsp (e.g., French punctuation).
 */

import { describe, it, expect } from 'vitest';
import { parseXmlResponse } from '../../src/utils/xmlTranslation.js';

const mockLogger = {
	warn: () => {},
	debug: () => {},
};

/**
 * Helper: build an XML response string from translations.
 */
function xml(translations) {
	return translations
		.map((t, i) => {
			if (typeof t === 'string') {
				return `<t i="${i + 1}">${escapeXml(t)}</t>`;
			}

			// Plural forms.
			const forms = t.map((f, fi) => `<f${fi}>${escapeXml(f)}</f${fi}>`).join('');

			return `<t i="${i + 1}">${forms}</t>`;
		})
		.join('\n');
}

function escapeXml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

describe('normalizeNbsp', () => {
	describe('trailing whitespace', () => {
		it('should normalize trailing nbsp to regular spaces when original has trailing spaces', () => {
			const batch = [{ msgid: 'Error: ' }];
			const translation = 'Ошибка:\u00A0';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Ошибка: ');
			expect(translations[0].msgstr[0]).not.toContain('\u00A0');
		});

		it('should normalize 20 trailing nbsp matching original trailing spaces', () => {
			const trailing = ' '.repeat(20);
			const batch = [{ msgid: `settings%9$s.\n${trailing}` }];
			const translation = `параметры%9$s.\n${'\u00A0'.repeat(20)}`;

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe(`параметры%9$s.\n${trailing}`);
			expect(translations[0].msgstr[0]).not.toContain('\u00A0');
		});
	});

	describe('leading whitespace', () => {
		it('should normalize leading nbsp to regular spaces when original has leading spaces', () => {
			const batch = [{ msgid: ' (separated by %s)' }];
			const translation = '\u00A0(разделено %s)';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe(' (разделено %s)');
			expect(translations[0].msgstr[0].charCodeAt(0)).toBe(0x20);
		});
	});

	describe('interior nbsp preserved', () => {
		it('should preserve nbsp before French punctuation marks', () => {
			const batch = [{ msgid: 'Error: Something went wrong' }];
			const translation = 'Erreur\u00A0: Quelque chose a mal tourné';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			// Interior nbsp before colon should be preserved.
			expect(translations[0].msgstr[0]).toContain('\u00A0:');
		});

		it('should preserve nbsp before French semicolon', () => {
			const batch = [{ msgid: 'one; two; three' }];
			const translation = 'un\u00A0; deux\u00A0; trois';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('un\u00A0; deux\u00A0; trois');
		});

		it('should preserve nbsp before French exclamation mark', () => {
			const batch = [{ msgid: 'Success!' }];
			const translation = 'Succès\u00A0!';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Succès\u00A0!');
		});

		it('should preserve nbsp before French question mark', () => {
			const batch = [{ msgid: 'Are you sure?' }];
			const translation = 'Êtes-vous sûr\u00A0?';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Êtes-vous sûr\u00A0?');
		});
	});

	describe('mixed cases', () => {
		it('should normalize trailing nbsp while preserving interior nbsp', () => {
			const batch = [{ msgid: 'Error: ' }];
			const translation = 'Erreur\u00A0:\u00A0';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			// Interior nbsp before colon preserved, trailing nbsp normalized.
			expect(translations[0].msgstr[0]).toBe('Erreur\u00A0: ');
			expect(translations[0].msgstr[0].endsWith(' ')).toBe(true);
			expect(translations[0].msgstr[0].charCodeAt(translations[0].msgstr[0].length - 1)).toBe(0x20);
		});

		it('should not modify translations without any nbsp', () => {
			const batch = [{ msgid: 'Hello world' }];
			const translation = 'Bonjour le monde';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Bonjour le monde');
		});

		it('should not modify translations when original has no leading/trailing spaces', () => {
			const batch = [{ msgid: 'Hello' }];
			const translation = 'Bonjour\u00A0!';

			const { translations } = parseXmlResponse(xml([translation]), batch, 1, mockLogger);

			// No trailing space in original, so nbsp is interior — preserved.
			expect(translations[0].msgstr[0]).toBe('Bonjour\u00A0!');
		});
	});

	describe('plural forms', () => {
		it('should normalize nbsp in plural form translations', () => {
			const batch = [{
				msgid: '%d entry found.                    ',
				msgid_plural: '%d entries found.                    ',
			}];

			const trailing = '\u00A0'.repeat(20);
			const forms = [
				`%d запись найдена.${trailing}`,
				`%d записи найдены.${trailing}`,
				`%d записей найдено.${trailing}`,
			];

			const { translations } = parseXmlResponse(xml([forms]), batch, 3, mockLogger);

			for (let i = 0; i < 3; i++) {
				expect(translations[0].msgstr[i]).not.toContain('\u00A0');
				expect(translations[0].msgstr[i]).toMatch(/ {20}$/);
			}
		});
	});
});

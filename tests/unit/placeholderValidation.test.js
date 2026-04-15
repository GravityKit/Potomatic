/**
 * Tests for placeholder extraction and validation in xmlTranslation.js.
 *
 * extractPlaceholders() is a private function, so all tests exercise it
 * indirectly through parseXmlResponse(). The placeholder validator runs
 * as a post-processing step inside parseXmlResponse and blanks translations
 * whose placeholders don't match the source string.
 */

import { describe, it, expect } from 'vitest';
import { parseXmlResponse } from '../../src/utils/xmlTranslation.js';

const mockLogger = {
	warn: () => {},
	debug: () => {},
};

/**
 * Tracks warning messages emitted by the placeholder validator.
 */
function createSpyLogger() {
	const warnings = [];

	return {
		logger: {
			warn: (msg) => warnings.push(msg),
			debug: () => {},
		},
		warnings,
	};
}

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

// ---------------------------------------------------------------------------
// extractPlaceholders (tested indirectly via parseXmlResponse)
// ---------------------------------------------------------------------------

describe('extractPlaceholders', () => {
	describe('simple format specifiers', () => {
		it('should extract %s placeholder', () => {
			const batch = [{ msgid: 'Hello %s' }];
			const { translations } = parseXmlResponse(xml(['Bonjour %s']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Bonjour %s');
		});

		it('should extract %d placeholder', () => {
			const batch = [{ msgid: '%d items' }];
			const { translations } = parseXmlResponse(xml(['%d элементов']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%d элементов');
		});

		it('should extract %f placeholder', () => {
			const batch = [{ msgid: 'Value: %f' }];
			const { translations } = parseXmlResponse(xml(['Значение: %f']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Значение: %f');
		});

		it('should extract %u placeholder', () => {
			const batch = [{ msgid: '%u users online' }];
			const { translations } = parseXmlResponse(xml(['%u пользователей онлайн']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%u пользователей онлайн');
		});
	});

	describe('positional format specifiers', () => {
		it('should extract %1$s style placeholders', () => {
			const batch = [{ msgid: '%1$s by %2$s' }];
			const { translations } = parseXmlResponse(xml(['%1$s от %2$s']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%1$s от %2$s');
		});

		it('should extract mixed positional types like %1$s and %2$d', () => {
			const batch = [{ msgid: '%1$s has %2$d entries' }];
			const { translations } = parseXmlResponse(xml(['%1$s имеет %2$d записей']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%1$s имеет %2$d записей');
		});

		it('should allow reordered positional placeholders in translation', () => {
			const batch = [{ msgid: '%1$s by %2$s on %3$s' }];
			// Translation reorders: %3$s first, then %1$s, then %2$s.
			const { translations } = parseXmlResponse(xml(['%3$s: %1$s (%2$s)']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%3$s: %1$s (%2$s)');
		});

		it('should extract high-numbered positional placeholder like %9$s', () => {
			const batch = [{ msgid: 'settings%9$s.' }];
			const { translations } = parseXmlResponse(xml(['параметры%9$s.']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('параметры%9$s.');
		});
	});

	describe('multiple placeholders', () => {
		it('should extract multiple %s placeholders', () => {
			const batch = [{ msgid: '%s of %s' }];
			const { translations } = parseXmlResponse(xml(['%s из %s']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%s из %s');
		});

		it('should extract mixed simple and positional placeholders', () => {
			const batch = [{ msgid: '%s items (%1$d selected)' }];
			const { translations } = parseXmlResponse(xml(['%s элементов (%1$d выбрано)']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%s элементов (%1$d выбрано)');
		});
	});

	describe('no placeholders', () => {
		it('should accept translation of plain text without placeholders', () => {
			const batch = [{ msgid: 'Hello world' }];
			const { translations } = parseXmlResponse(xml(['Bonjour le monde']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Bonjour le monde');
		});
	});

	describe('escaped percent (%%)', () => {
		it('should NOT extract %% as a placeholder', () => {
			// "%%" in printf means a literal percent sign, not a placeholder.
			// The regex /%(?:\d+\$)?[sdfu]/g should not match "%%s" as "%s"
			// because the first % escapes the second.
			// NOTE: This test documents current behavior. The regex does not
			// handle %% escaping — it will extract "%s" from "%%s". This is
			// a known limitation but acceptable because both source and
			// translation will have the same false positive.
			const batch = [{ msgid: '100%% complete' }];
			const { translations } = parseXmlResponse(xml(['100%% terminé']), batch, 1, mockLogger);

			// Both source and translation have the same "no placeholders" (since
			// %%  does not match [sdfu] after the second %).
			expect(translations[0].msgstr[0]).toBe('100%% terminé');
		});

		it('should handle %%s where %% is escape and s is literal', () => {
			// "%%s" in C printf means literal "%s" displayed, not a placeholder.
			// However, the regex will match "%s" from "%%s". Both source and
			// translation will get the same false match, so validation passes.
			const batch = [{ msgid: '%%s is literal' }];
			const { translations } = parseXmlResponse(xml(['%%s est littéral']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%%s est littéral');
		});
	});
});

// ---------------------------------------------------------------------------
// Placeholder validation (post-processing step in parseXmlResponse)
// ---------------------------------------------------------------------------

describe('placeholder validation', () => {
	describe('correct placeholders (should pass)', () => {
		it('should keep translation with identical placeholders', () => {
			const batch = [{ msgid: 'Hello %s, you have %d items' }];
			const { translations } = parseXmlResponse(xml(['Bonjour %s, vous avez %d articles']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('Bonjour %s, vous avez %d articles');
		});

		it('should keep translation with positional placeholders in different order', () => {
			const batch = [{ msgid: '%1$s has %2$d entries in %3$s' }];
			const { translations } = parseXmlResponse(xml(['В %3$s у %1$s есть %2$d записей']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('В %3$s у %1$s есть %2$d записей');
		});
	});

	describe('extra placeholder (should blank)', () => {
		it('should blank translation that adds an extra %s', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'Hello %s' }];

			const { translations } = parseXmlResponse(xml(['Bonjour %s %s']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});

		it('should blank translation that adds a placeholder type not in source', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'Hello %s' }];

			const { translations } = parseXmlResponse(xml(['Bonjour %s (%d)']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});
	});

	describe('missing placeholder (should blank)', () => {
		it('should blank translation missing a %s placeholder', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: '%s has %d entries' }];

			const { translations } = parseXmlResponse(xml(['имеет %d записей']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});

		it('should blank translation missing all placeholders', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'View %1$s by %2$s' }];

			const { translations } = parseXmlResponse(xml(['Просмотреть запись автора']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});
	});

	describe('string with no placeholders — translation adds one (should blank)', () => {
		it('should blank when source has no placeholders but translation introduces %s', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'Hello world' }];

			const { translations } = parseXmlResponse(xml(['Bonjour %s monde']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});

		it('should blank when source has no placeholders but translation introduces %d', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'Settings' }];

			const { translations } = parseXmlResponse(xml(['Настройки %d']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});
	});

	describe('fullwidth percent sign (should blank)', () => {
		it('should blank translation using fullwidth ％s instead of %s', () => {
			// Fullwidth ％ (U+FF05) is a different character. The regex won't
			// match it, so the translation will appear to have no placeholders
			// while the source has %s — mismatch.
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: 'Hello %s' }];

			const { translations } = parseXmlResponse(xml(['Bonjour \uFF05s']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});

		it('should blank when all placeholders use fullwidth percent', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: '%1$s by %2$s' }];

			const { translations } = parseXmlResponse(xml(['\uFF051$s от \uFF052$s']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('');
			expect(warnings.some((w) => w.includes('Placeholder mismatch'))).toBe(true);
		});
	});

	describe('plural forms', () => {
		it('should pass when all plural forms have correct placeholders from msgid_plural', () => {
			const batch = [
				{
					msgid: '%d entry found',
					msgid_plural: '%d entries found',
				},
			];

			const forms = ['%d запись найдена', '%d записи найдены', '%d записей найдено'];

			const { translations } = parseXmlResponse(xml([forms]), batch, 3, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%d запись найдена');
			expect(translations[0].msgstr[1]).toBe('%d записи найдены');
			expect(translations[0].msgstr[2]).toBe('%d записей найдено');
		});

		it('should pass when plural form 0 drops %d (Arabic/Japanese singular)', () => {
			// In Arabic, form 0 is the "zero" form; in Japanese, form 0 is the
			// only form. For languages where singular form doesn't use a number,
			// the placeholder may be absent.
			const batch = [
				{
					msgid: '%d entry',
					msgid_plural: '%d entries',
				},
			];

			const forms = [
				'запись', // Form 0: no %d (language says "one entry" without number).
				'%d записи',
				'%d записей',
			];

			const { translations } = parseXmlResponse(xml([forms]), batch, 3, mockLogger);

			// Form 0 with no placeholders should be accepted.
			expect(translations[0].msgstr[0]).toBe('запись');
			expect(translations[0].msgstr[1]).toBe('%d записи');
			expect(translations[0].msgstr[2]).toBe('%d записей');
		});

		it('should pass when plural form 0 matches plural placeholders instead of singular', () => {
			// Form 0 can also match the plural's placeholders.
			const batch = [
				{
					msgid: '%d item in %s',
					msgid_plural: '%d items in %s',
				},
			];

			const forms = ['%d элемент в %s', '%d элемента в %s'];

			const { translations } = parseXmlResponse(xml([forms]), batch, 2, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%d элемент в %s');
			expect(translations[0].msgstr[1]).toBe('%d элемента в %s');
		});

		it('should blank plural form 1+ when placeholder is missing', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [
				{
					msgid: '%d entry',
					msgid_plural: '%d entries',
				},
			];

			const forms = [
				'%d запись',
				'записи', // Form 1: missing %d.
				'%d записей',
			];

			const { translations } = parseXmlResponse(xml([forms]), batch, 3, logger);

			expect(translations[0].msgstr[0]).toBe('%d запись');
			expect(translations[0].msgstr[1]).toBe(''); // Blanked.
			expect(translations[0].msgstr[2]).toBe('%d записей');
			expect(warnings.some((w) => w.includes('form 1'))).toBe(true);
		});

		it('should blank plural form 0 when it has extra placeholders', () => {
			const { logger } = createSpyLogger();
			const batch = [
				{
					msgid: '%d entry',
					msgid_plural: '%d entries',
				},
			];

			const forms = [
				'%d %s запись', // Form 0: has extra %s.
				'%d записи',
				'%d записей',
			];

			const { translations } = parseXmlResponse(xml([forms]), batch, 3, logger);

			expect(translations[0].msgstr[0]).toBe(''); // Blanked.
			expect(translations[0].msgstr[1]).toBe('%d записи');
			expect(translations[0].msgstr[2]).toBe('%d записей');
		});
	});

	describe('validation stats', () => {
		it('should increment stringsWithPluralIssues when placeholder mismatch occurs', () => {
			const batch = [{ msgid: 'Hello %s' }];

			const { validationStats } = parseXmlResponse(xml(['Bonjour']), batch, 1, mockLogger);

			expect(validationStats.stringsWithPluralIssues).toBeGreaterThan(0);
		});

		it('should not increment stats when placeholders match', () => {
			const batch = [{ msgid: 'Hello %s' }];

			const { validationStats } = parseXmlResponse(xml(['Bonjour %s']), batch, 1, mockLogger);

			expect(validationStats.stringsWithPluralIssues).toBe(0);
		});
	});

	describe('edge cases', () => {
		it('should handle empty translation gracefully (skip validation)', () => {
			const batch = [{ msgid: 'Hello %s' }];

			// Empty translation tag.
			const { translations } = parseXmlResponse('<t i="1"></t>', batch, 1, mockLogger);

			// Empty string should not be blanked further — it's already empty.
			expect(translations[0].msgstr[0]).toBe('');
		});

		it('should handle source with only a placeholder', () => {
			const batch = [{ msgid: '%s' }];
			const { translations } = parseXmlResponse(xml(['%s']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('%s');
		});

		it('should handle multiple entries in a batch independently', () => {
			const { logger } = createSpyLogger();
			const batch = [{ msgid: 'Hello %s' }, { msgid: 'Count: %d' }];

			// First translation is correct, second is missing %d.
			const { translations } = parseXmlResponse(xml(['Bonjour %s', 'Счет:']), batch, 1, logger);

			expect(translations[0].msgstr[0]).toBe('Bonjour %s');
			expect(translations[1].msgstr[0]).toBe('');
		});

		it('should handle percent followed by unsupported specifier (not s/d/f/u)', () => {
			// %c, %x, %o, %e are not matched by the regex. If the source has
			// them, they won't be extracted, so no validation happens for them.
			// This documents the current behavior — only s, d, f, u are validated.
			const batch = [{ msgid: 'Char: %c' }];
			const { translations } = parseXmlResponse(xml(['Символ: %c']), batch, 1, mockLogger);

			// Both source and translation extract nothing — match, so it passes.
			expect(translations[0].msgstr[0]).toBe('Символ: %c');
		});

		it('should handle percent at end of string without specifier', () => {
			const batch = [{ msgid: '100%' }];
			const { translations } = parseXmlResponse(xml(['100%']), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('100%');
		});
	});

	describe('Arabic 6-form plural validation (pluralCount === 6)', () => {
		it('should accept Arabic f1 (one) dropping %d', () => {
			const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];
			const forms = ['%d عنصر', 'عنصر واحد', 'عنصران', '%d عناصر', '%d عنصر', '%d عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			expect(translations[0].msgstr[1]).toBe('عنصر واحد');
		});

		it('should accept Arabic f2 (dual) dropping %d', () => {
			const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];
			const forms = ['%d عنصر', 'عنصر واحد', 'عنصران', '%d عناصر', '%d عنصر', '%d عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			expect(translations[0].msgstr[2]).toBe('عنصران');
		});

		it('should reject Arabic f3+ dropping %d', () => {
			const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];
			const forms = ['%d عنصر', 'عنصر واحد', 'عنصران', 'عناصر', '%d عنصر', '%d عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			expect(translations[0].msgstr[3]).toBe('');
		});

		it('should NOT allow Arabic forms to drop %s (string placeholder)', () => {
			const batch = [{ msgid: 'One %s item', msgid_plural: '%d %s items' }];
			const forms = ['%d %s عنصر', '%s عنصر واحد', '%s عنصران', '%d %s عناصر', '%d %s عنصر', '%d %s عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			// f1 drops %d (numeric) but keeps %s — should be accepted.
			expect(translations[0].msgstr[1]).toBe('%s عنصر واحد');
			// f2 drops %d but keeps %s — accepted.
			expect(translations[0].msgstr[2]).toBe('%s عنصران');
		});

		it('should reject Arabic form dropping %s without %d in source', () => {
			const batch = [{ msgid: 'One %s item', msgid_plural: '%s items' }];
			const forms = ['%s عنصر', 'عنصر واحد', 'عنصران', '%s عناصر', '%s عنصر', '%s عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			// f1 drops %s which is a string placeholder — should be blanked.
			expect(translations[0].msgstr[1]).toBe('');
		});

		it('should NOT allow Russian f1 to drop %d (pluralCount=3)', () => {
			const batch = [{ msgid: '%d item', msgid_plural: '%d items' }];
			const forms = ['%d элемент', 'элемента', '%d элементов'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 3, mockLogger);

			// Russian f1 (few) must keep %d — pluralCount is 3, not 6.
			expect(translations[0].msgstr[1]).toBe('');
		});

		it('should NOT allow Japanese f0 to drop %d (pluralCount=1)', () => {
			const batch = [{ msgid: '%d item', msgid_plural: '%d items' }];
			const forms = ['アイテム'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 1, mockLogger);

			expect(translations[0].msgstr[0]).toBe('');
		});

		it('should reject Arabic f0 dropping one of two duplicate %d placeholders', () => {
			const batch = [{ msgid: '%d of %d items', msgid_plural: '%d of %d items' }];
			// Translation drops one %d — should be rejected (sprintf would break).
			const forms = ['%d عنصر', 'عنصر واحد', 'عنصران', '%d من %d عناصر', '%d من %d عنصر', '%d من %d عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			// f0 has one %d but source has two — must reject.
			expect(translations[0].msgstr[0]).toBe('');
			// f3-5 have both %d — should pass.
			expect(translations[0].msgstr[3]).toBe('%d من %d عناصر');
		});

		it('should accept Arabic f0 dropping both %d when source has two', () => {
			const batch = [{ msgid: '%d of %d items', msgid_plural: '%d of %d items' }];
			// f0 drops both %d — acceptable for zero form.
			const forms = ['لا عناصر', 'عنصر واحد', 'عنصران', '%d من %d عناصر', '%d من %d عنصر', '%d من %d عنصر'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			expect(translations[0].msgstr[0]).toBe('لا عناصر');
		});
	});

	describe('singular entries with form tags', () => {
		it('should extract only f0 when AI returns plural forms for a singular entry', () => {
			// AI incorrectly returns <f0>...<f5> for a singular string like "30 files".
			const batch = [{ msgid: '30 files' }];
			const forms = ['30 ملفًا', '30 ملف', '30 ملفان', '%d ملفات', '%d ملفًا', '%d ملف'];
			const { translations } = parseXmlResponse(xml([forms]), batch, 6, mockLogger);

			expect(translations[0].msgstr).toHaveLength(1);
			expect(translations[0].msgstr[0]).toBe('30 ملفًا');
		});

		it('should initialize singular entries with 1 msgstr slot', () => {
			const batch = [{ msgid: 'Hello' }, { msgid: 'One item', msgid_plural: '%d items' }];
			const { translations } = parseXmlResponse('', batch, 6, mockLogger);

			expect(translations[0].msgstr).toHaveLength(1);
			expect(translations[1].msgstr).toHaveLength(6);
		});

		it('should not trigger placeholder warnings for discarded plural forms', () => {
			const { logger, warnings } = createSpyLogger();
			const batch = [{ msgid: '30 files' }];
			// AI adds %d in forms 3-5 — these should be discarded, not warned about.
			const forms = ['30 ملفًا', '30 ملف', '30 ملفان', '%d ملفات', '%d ملفًا', '%d ملف'];
			parseXmlResponse(xml([forms]), batch, 6, logger);

			const placeholderWarnings = warnings.filter((w) => w.includes('Placeholder mismatch'));

			expect(placeholderWarnings).toHaveLength(0);
		});
	});
});

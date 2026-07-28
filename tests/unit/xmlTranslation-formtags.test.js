import { describe, it, expect } from 'vitest';
import { parseXmlResponse } from '../../src/utils/xmlTranslation.js';

const logger = { warn: () => {}, debug: () => {}, info: () => {}, error: () => {} };
const batch = [{ msgid: 'Select at least %d field.', msgid_plural: 'Select at least %d fields.' }];
const forms = ['Wybierz co najmniej %d pole.', 'Wybierz %d pola.', 'Wybierz %d pol.'];

/**
 * Models intermittently emit a malformed opening form tag such as `<f0">`. A strict
 * match sends the entry down the singular branch, which captures all three forms as one
 * string; the placeholder validator then sees three `%d` where one is expected and blanks
 * every form, silently shipping the entry untranslated.
 */
describe('parseXmlResponse plural form tags', () => {
	const cases = {
		'well-formed tags': `<t i="1"><f0>${forms[0]}</f0><f1>${forms[1]}</f1><f2>${forms[2]}</f2></t>`,
		'stray quote on the first tag': `<t i="1"><f0">${forms[0]}</f0><f1>${forms[1]}</f1><f2>${forms[2]}</f2></t>`,
		'stray quote on a later tag': `<t i="1"><f0>${forms[0]}</f0><f1">${forms[1]}</f1><f2>${forms[2]}</f2></t>`,
		'attributes on the tag': `<t i="1"><f0 n="0">${forms[0]}</f0><f1>${forms[1]}</f1><f2>${forms[2]}</f2></t>`,
	};

	for (const [name, xml] of Object.entries(cases)) {
		it(`recovers all plural forms with ${name}`, () => {
			const { translations } = parseXmlResponse(xml, batch, 3, logger, 0, 0);

			expect(translations[0].msgstr).toEqual(forms);
		});
	}

	it('still treats a genuinely singular response as singular', () => {
		const { translations } = parseXmlResponse('<t i="1">Zapisano.</t>', [{ msgid: 'Saved.' }], 1, logger, 0, 0);

		expect(translations[0].msgstr).toEqual(['Zapisano.']);
	});
});

describe('parseXmlResponse form tag boundaries', () => {
	const pluralBatch = [{ msgid: 'x %d', msgid_plural: 'x %d plural' }];
	const logger = { warn: () => {}, debug: () => {}, info: () => {}, error: () => {} };

	// Tolerating stray characters must not extend to a different tag name: `<f10>` is not
	// form 1, and `<f0evil>` is not form 0. Accepting either silently corrupts output.
	it('does not read <f10> as form 1', () => {
		const xml = '<t i="1"><f0>A</f0><f10>TEN</f10><f2>C</f2></t>';
		const { translations } = parseXmlResponse(xml, pluralBatch, 3, logger, 0, 0);

		expect(translations[0].msgstr).not.toContain('TEN');
	});

	it('does not read <f0evil> as form 0', () => {
		const xml = '<t i="1"><f0evil>PWN</f0evil><f1>B</f1><f2>C</f2></t>';
		const { translations } = parseXmlResponse(xml, pluralBatch, 3, logger, 0, 0);

		expect(translations[0].msgstr[0]).not.toBe('PWN');
	});
});

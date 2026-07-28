import { describe, it, expect } from 'vitest';
import { TranslationOrchestrator } from '../../src/orchestrator/index.js';

/**
 * A partially translated run leaves untranslated strings in the .po file. Exiting 0 and
 * logging success hides that from anyone running this unattended or in CI.
 */
describe('_determineExitCode', () => {
	const orchestrator = (messages) => {
		const instance = Object.create(TranslationOrchestrator.prototype);

		instance.config = { outputFormat: 'console' };
		instance.mainLogger = {
			warn: (m) => messages.push(`warn: ${m}`),
			success: (m) => messages.push(`success: ${m}`),
			error: (m) => messages.push(`error: ${m}`),
			info: () => {},
			debug: () => {},
		};

		return instance;
	};

	it('succeeds when every string was translated', () => {
		const messages = [];

		expect(orchestrator(messages)._determineExitCode([{ translatedInRun: 10, failedInRun: 0 }])).toBe(0);
		expect(messages[0]).toMatch(/success/);
	});

	it('fails when some strings were translated and some were not', () => {
		const messages = [];

		expect(orchestrator(messages)._determineExitCode([{ translatedInRun: 8, failedInRun: 2 }])).toBe(1);
		expect(messages[0]).toMatch(/2 strings left untranslated/);
	});

	it('fails when one language of several is only partially translated', () => {
		const messages = [];
		const stats = [
			{ translatedInRun: 10, failedInRun: 0 },
			{ translatedInRun: 9, failedInRun: 1 },
		];

		expect(orchestrator(messages)._determineExitCode(stats)).toBe(1);
	});

	it('fails when nothing was translated', () => {
		expect(orchestrator([])._determineExitCode([{ translatedInRun: 0, failedInRun: 10 }])).toBe(1);
	});
});

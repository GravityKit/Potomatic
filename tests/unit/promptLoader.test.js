/**
 * Tests for prompt loading, --extra-prompt-path, and template substitution.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { buildSystemPrompt } from '../../src/utils/promptLoader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, '..', 'temp');
const tempFiles = [];

function writeTempFile(name, content) {
	fs.mkdirSync(tempDir, { recursive: true });

	const filePath = path.join(tempDir, name);

	fs.writeFileSync(filePath, content);
	tempFiles.push(filePath);

	return filePath;
}

afterEach(() => {
	while (tempFiles.length) {
		const f = tempFiles.pop();

		if (fs.existsSync(f)) {
			fs.unlinkSync(f);
		}
	}
});

describe('buildSystemPrompt', () => {
	describe('default prompt', () => {
		it('should load default prompt with placeholder rules', () => {
			const prompt = buildSystemPrompt('fr_FR');

			expect(prompt).toContain('CRITICAL');
			expect(prompt).toContain('French (France)');
			expect(prompt).toContain('Arabic');
			expect(prompt).not.toContain('{{TARGET_LANGUAGE}}');
			expect(prompt).not.toContain('{{PLURAL_COUNT}}');
		});

		it('should substitute plural count for Arabic (6 forms)', () => {
			const prompt = buildSystemPrompt('ar');

			expect(prompt).toContain('6');
		});

		it('should substitute plural count for Japanese (1 form)', () => {
			const prompt = buildSystemPrompt('ja');

			expect(prompt).toContain('1');
		});
	});

	describe('--prompt-file-path (full override)', () => {
		it('should fully override default prompt', () => {
			const custom = writeTempFile('override.md', 'Custom prompt for {{TARGET_LANGUAGE}}.');
			const prompt = buildSystemPrompt('de_DE', 'English', custom);

			expect(prompt).toBe('Custom prompt for German.');
			expect(prompt).not.toContain('CRITICAL');
		});
	});

	describe('--extra-prompt-path (append to default)', () => {
		it('should append extra content to default prompt', () => {
			const extra = writeTempFile('extra.md', '### Domain Terms\n- "View" means a data display.');
			const prompt = buildSystemPrompt('ru_RU', 'English', null, extra);

			expect(prompt).toContain('CRITICAL');
			expect(prompt).toContain('Domain Terms');
			expect(prompt).toContain('"View" means a data display.');
		});

		it('should append extra content to overridden prompt', () => {
			const custom = writeTempFile('custom.md', 'Base override.');
			const extra = writeTempFile('extra2.md', 'Extra terminology.');
			const prompt = buildSystemPrompt('ja', 'English', custom, extra);

			expect(prompt).toContain('Base override.');
			expect(prompt).toContain('Extra terminology.');
			expect(prompt).not.toContain('CRITICAL');
		});

		it('should throw for nonexistent extra prompt file', () => {
			expect(() => {
				buildSystemPrompt('fr_FR', 'English', null, '/nonexistent/path.md');
			}).toThrow('Extra prompt file not found');
		});

		it('should replace template variables in extra prompt', () => {
			const extra = writeTempFile('extra-vars.md', 'Translate to {{TARGET_LANGUAGE}} with {{PLURAL_COUNT}} forms.');
			const prompt = buildSystemPrompt('ar', 'English', null, extra);

			expect(prompt).toContain('Translate to Arabic with 6 forms.');
		});
	});
});

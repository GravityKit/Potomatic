/**
 * Dictionary utilities tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadDictionary, findDictionaryMatches, validateDictionary } from '../../src/utils/dictionaryUtils.js';
import { createTempDir, cleanupTempDir } from '../helpers/temp-files.js';

describe('Dictionary Utils', () => {
	let tempDir;
	let mockLogger;

	beforeEach(async () => {
		tempDir = await createTempDir();
		mockLogger = {
			debug: () => {},
			warn: () => {},
			info: () => {},
			error: () => {},
		};
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
	});

	describe('loadDictionary', () => {
		it('should return null when directory does not exist', () => {
			const result = loadDictionary('/nonexistent/path', 'fr_FR', mockLogger);
			expect(result).toBeNull();
		});

		it('should load language-specific dictionary', () => {
			const dictPath = path.join(tempDir, 'dictionary-fr-fr.json');
			const dictionary = {
				Login: 'Connexion',
				Dashboard: 'Tableau de bord',
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = loadDictionary(tempDir, 'fr_FR', mockLogger);
			expect(result).toEqual({
				login: 'Connexion',
				dashboard: 'Tableau de bord',
			});
		});

		it('should fallback to base language dictionary', () => {
			const dictPath = path.join(tempDir, 'dictionary-fr.json');
			const dictionary = {
				Login: 'Connexion',
				Settings: 'Paramètres',
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = loadDictionary(tempDir, 'fr_FR', mockLogger);
			expect(result).toEqual({
				login: 'Connexion',
				settings: 'Paramètres',
			});
		});

		it('should fallback to default dictionary', () => {
			const dictPath = path.join(tempDir, 'dictionary.json');
			const dictionary = {
				Login: 'Sign In',
				Logout: 'Sign Out',
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = loadDictionary(tempDir, 'de_DE', mockLogger);
			expect(result).toEqual({
				login: 'Sign In',
				logout: 'Sign Out',
			});
		});

		it('should prioritize specific over base over default', () => {
			// Create all three dictionaries
			const specificDict = { source: 'specific' };
			const baseDict = { source: 'base' };
			const defaultDict = { source: 'default' };

			fs.writeFileSync(path.join(tempDir, 'dictionary-fr-fr.json'), JSON.stringify(specificDict));
			fs.writeFileSync(path.join(tempDir, 'dictionary-fr.json'), JSON.stringify(baseDict));
			fs.writeFileSync(path.join(tempDir, 'dictionary.json'), JSON.stringify(defaultDict));

			const result = loadDictionary(tempDir, 'fr_FR', mockLogger);
			expect(result).toEqual(specificDict);
		});

		it('should handle invalid JSON gracefully', () => {
			const dictPath = path.join(tempDir, 'dictionary.json');
			fs.writeFileSync(dictPath, 'invalid json {');

			const result = loadDictionary(tempDir, 'fr_FR', mockLogger);
			expect(result).toBeNull();
		});

		it('should skip invalid dictionary format', () => {
			const invalidPath = path.join(tempDir, 'dictionary-invalid.json');
			const validPath = path.join(tempDir, 'dictionary.json');

			fs.writeFileSync(invalidPath, JSON.stringify(['not', 'an', 'object']));
			fs.writeFileSync(validPath, JSON.stringify({ Login: 'Connexion' }));

			const result = loadDictionary(tempDir, 'invalid', mockLogger);
			expect(result).toEqual({ login: 'Connexion' });
		});
	});

	describe('findDictionaryMatches', () => {
		const dictionary = {
			login: 'Connexion',
			dashboard: 'Tableau de bord',
			'user settings': 'Paramètres utilisateur',
			api: 'API',
		};

		it('should find matching terms in batch', () => {
			const batch = [{ msgid: 'Please login to continue' }, { msgid: 'Welcome to your dashboard' }, { msgid: 'Save changes' }];

			const matches = findDictionaryMatches(batch, dictionary);
			expect(matches).toEqual([
				{ source: 'login', target: 'Connexion' },
				{ source: 'dashboard', target: 'Tableau de bord' },
			]);
		});

		it('should handle case-insensitive matching', () => {
			const batch = [{ msgid: 'LOGIN required' }, { msgid: 'View DASHBOARD' }];

			const matches = findDictionaryMatches(batch, dictionary);
			expect(matches).toEqual([
				{ source: 'login', target: 'Connexion' },
				{ source: 'dashboard', target: 'Tableau de bord' },
			]);
		});

		it('should return empty array for no matches', () => {
			const batch = [{ msgid: 'No matching terms here' }];

			const matches = findDictionaryMatches(batch, dictionary);
			expect(matches).toEqual([]);
		});

		it('should return empty array for null/empty inputs', () => {
			expect(findDictionaryMatches(null, dictionary)).toEqual([]);
			expect(findDictionaryMatches([], dictionary)).toEqual([]);
			expect(findDictionaryMatches([{ msgid: 'test' }], null)).toEqual([]);
		});

		it('should skip invalid dictionary entries', () => {
			const invalidDict = {
				login: 'Connexion',
				invalidKey: null,
				'': 'empty key',
				normalKey: '',
				123: 'numeric key',
			};

			const batch = [{ msgid: 'Please login' }];
			const matches = findDictionaryMatches(batch, invalidDict);
			expect(matches).toEqual([{ source: 'login', target: 'Connexion' }]);
		});

		it('should handle multi-word terms', () => {
			const batch = [{ msgid: 'Update your user settings in the profile tab' }];

			const matches = findDictionaryMatches(batch, dictionary);
			expect(matches).toEqual([{ source: 'user settings', target: 'Paramètres utilisateur' }]);
		});

		it('should handle items with missing msgid', () => {
			const batch = [{ msgid: 'Login here' }, { notMsgid: 'invalid' }, { msgid: null }];

			const matches = findDictionaryMatches(batch, dictionary);
			expect(matches).toEqual([{ source: 'login', target: 'Connexion' }]);
		});
	});

	describe('validateDictionary', () => {
		it('should validate correct dictionary file', () => {
			const dictPath = path.join(tempDir, 'valid.json');
			const dictionary = {
				Login: 'Connexion',
				Logout: 'Déconnexion',
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = validateDictionary(dictPath);
			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
			expect(result.entryCount).toBe(2);
		});

		it('should report missing file', () => {
			const result = validateDictionary(path.join(tempDir, 'missing.json'));
			expect(result.isValid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Dictionary file not found');
		});

		it('should report invalid JSON', () => {
			const dictPath = path.join(tempDir, 'invalid.json');
			fs.writeFileSync(dictPath, 'invalid json');

			const result = validateDictionary(dictPath);
			expect(result.isValid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid JSON format');
		});

		it('should report non-object dictionary', () => {
			const dictPath = path.join(tempDir, 'array.json');
			fs.writeFileSync(dictPath, JSON.stringify(['not', 'object']));

			const result = validateDictionary(dictPath);
			expect(result.isValid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('must be a JSON object');
		});

		it('should warn about invalid entries but remain valid', () => {
			const dictPath = path.join(tempDir, 'mixed.json');
			const dictionary = {
				Login: 'Connexion', // Valid
				invalidNumber: 123, // Invalid - not string
				'': 'empty key', // Invalid - empty key
				validKey: '', // Invalid - empty value
				Dashboard: 'Tableau de bord', // Valid
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = validateDictionary(dictPath);
			expect(result.isValid).toBe(true);
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.entryCount).toBe(2); // Only Login and Dashboard
		});

		it('should warn when no valid entries exist', () => {
			const dictPath = path.join(tempDir, 'empty.json');
			const dictionary = {
				invalidKey: 123,
				'': 'empty',
			};
			fs.writeFileSync(dictPath, JSON.stringify(dictionary));

			const result = validateDictionary(dictPath);
			expect(result.isValid).toBe(true);
			expect(result.warnings).toContain('Dictionary contains no valid entries');
			expect(result.entryCount).toBe(0);
		});
	});
});

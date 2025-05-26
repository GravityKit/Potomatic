import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Use single fork to avoid worker-related issues with mocking
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},

		// Test file patterns
		include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],

		// Setup files
		setupFiles: ['tests/setup.js'],

		// Environment
		environment: 'node',

		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: 'tests/coverage',
			include: ['src/**/*.js'],
			exclude: ['src/**/*.test.js', 'src/**/*.spec.js', 'tests/**/*', 'node_modules/**/*'],
			thresholds: {
				global: {
					branches: 50,
					functions: 50,
					lines: 50,
					statements: 50,
				},
			},
		},

		// Timeout settings
		testTimeout: 30000,
		hookTimeout: 30000,

		// Reporter
		reporter: ['verbose'],

		// Globals
		globals: false,
	},
});

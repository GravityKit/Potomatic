# Changelog

## 1.2.0 — 2026-04-06

### Fixed

* Output directory was not being created when saving .po files if it didn't exist.

### Added

* Post-translation validation that catches placeholder mismatches, non-breaking space issues, and plural form errors - blanking bad translations for automatic retry.
* New `--extra-prompt-path` CLI flag to append domain-specific prompt content without replacing the base prompt.
* Language-specific plural form guidance in the default prompt (Arabic 6-form, Russian 3-form, French 2-form, Japanese 1-form).
* XML source elements now include a `placeholders` attribute listing expected placeholders for LLM verification.

### Changed

* Update OpenAI models and pricing to April 2026.
* Default model changed from `gpt-4o-mini` to `gpt-4.1-mini`.
* Hardened default prompt with explicit negative examples for placeholder preservation.
* Blanked translation details now logged at warn level instead of debug.

## 1.1.0 — 2025-11-12

### Fixed

* Fix plural-form translations in languages with complex rules (e.g., Arabic, Russian,).
* Treat environment variables such as `FORCE_TRANSLATE=false` correctly instead of interpreting them as `true`.
* Ensure configuration files are detected when running Potomatic from paths containing spaces (such as `~/Local Sites/`) and on Windows systems.

### Added

* Support multiple API key formats (`OPENAI_API_KEY`, `POTOMATIC_OPENAI_API_KEY`, etc.) with automatic provider detection based on the key name.
* Add CLI options `--prompt-file-path` and `--po-header-template-path` to customize the locations of translation prompt and header template files.

### Changed

* Update OpenAI pricing data to reflect current model costs (November 2025).

## 1.0.1 — 2025-06-27

* Version bump for [npm release](https://www.npmjs.com/package/potomatic).

## 1.0.0 — 2025-06-27

* Initial release.

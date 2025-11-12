# Changelog

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

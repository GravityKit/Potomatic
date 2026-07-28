# Changelog

## 1.3.0 — 2026-07-28

### Upgrade notes

No flags, environment variables or model names were removed, but three behaviours change:

* **A partly translated run now exits `1` instead of `0`.** Previously only a run with no successful translations at all failed, so a `.po` with untranslated strings still reported success. Check any pipeline that treats a non-zero exit as fatal.
* **The default model is now `gpt-5.4-mini`.** Output and per-token rates both change: against this pricing table, input is 87.5% higher and output 181.25% higher. Pin the previous behaviour with `--model gpt-4.1-mini` or `MODEL=gpt-4.1-mini`.
* **GPT-5 models now work.** A configuration naming one previously failed every request; it will now do real, billable work.

### Added

* `--allow-unknown-model` (or `ALLOW_UNKNOWN_MODEL=true`) accepts a model that is not in the pricing catalogue, costed at the fallback rate. Without it, a model missing from `config/openai-pricing.json` is rejected, which would otherwise mean waiting for a release to use a newly published model.

### Fixed

* GPT-5 models could not be used at all. Every request sent `max_tokens`, which the GPT-5 and o-series families reject. Requests now send `max_completion_tokens` for those models and keep `max_tokens` for the supported GPT-4.1 models.
* `temperature` is now omitted for models that accept only the default value (the GPT-5.6 and GPT-5.5 families, the GPT-5 base family, and the o-series), which previously failed the request outright.
* Reasoning models were starved of completion budget. The token limit was sized from estimated visible output, but on the `max_completion_tokens` path that same limit also pays for hidden reasoning, which is largely fixed rather than proportional to the batch. Small batches therefore truncated: in our tested configurations `gpt-5-nano` and `gpt-5-mini` failed every run at batch sizes 1 to 5 while batches of 10 or more succeeded. Those models now get a flat headroom allowance. Raising the limit is not prepaid, though any extra tokens a model does generate are billable.
* A truncated response was parsed as zero translations and written out as blank strings while the run reported success. Truncation is now detected via `finish_reason` and fails the batch without retrying, since an unchanged retry is unlikely to help and incurs another charge.
* Potomatic's parser required an exact `<f0>` tag, so a malformed opening tag such as `<f0">` sent the entry down the singular path and blanked every plural form, shipping it untranslated. Form tags are now matched tolerantly while still requiring the tag name to end, so `<f10>` is not read as form 1 and `<f0evil>` is not read as form 0.
* Token counting fell back to a rough `length / 4` estimate for GPT-5 names that tiktoken does not recognise. It now falls back to the `o200k_base` encoding those models use, which matches the API's own token accounting exactly in our tests.
* Token encoders were rebuilt after every successfully returned response, costing roughly 60 ms each. They are now created once per model and shared.
* `--temperature 0` and `TEMPERATURE=0` were silently replaced by the default, because zero was treated as unset.
* The A/B prompt tool crashed with `translations.map is not a function` on every run, because it treated the `{ translations, validationStats }` object returned by `parseXmlResponse()` as an array.

### Changed

* Documentation no longer describes providers other than OpenAI. The README and `.env.example` advertised Gemini and Anthropic keys with automatic provider detection, but `--provider gemini` fails outright and a `GEMINI_API_KEY` was only ever used as an OpenAI key. The `--provider` flag still works for `openai` and is now hidden from `--help` until there is a second provider to choose.
* OpenAI models and pricing updated to July 2026, adding the GPT-5.6 (Sol, Terra, Luna) and GPT-5.5 tiers.
* The model catalogue lists only models the chat completions endpoint serves, which excludes the `-pro` tiers. None of them were listed in 1.2.0, so no existing configuration is affected.
* `tiktoken` updated to 1.0.22, which recognises more model names directly. Counts are unchanged, since every name it knows resolves to the same `o200k_base` encoding used for the rest.
* The `ab-prompt-test` npm script has been removed. `tools/` is not published, so the script pointed at a file that was never in the package; run `node tools/ab-prompt-test` from a checkout instead.
* A batch that failed after being billed now reports what it cost instead of zero, so `--max-cost` accounts for it, and the failure message states the number of attempts actually made.
* The A/B prompt tool no longer hardcodes its two models, which were outside the supported catalogue. Models, temperatures and target language are set with `AB_MODEL_A`, `AB_MODEL_B`, `AB_TEMP_A`, `AB_TEMP_B` and `AB_LANG`.

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

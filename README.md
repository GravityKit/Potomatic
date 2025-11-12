# Potomatic

<div align="center">
  <img src="assets/terminal.gif" alt="Animated image showing Potomatic in action" width="800">
</div>

<br />

**Potomatic** is a command-line tool for translating `.pot` (Portable Object Template) files into multiple languages using AI (currently OpenAI). We built it to streamline large-scale localization of WordPress products, a process we detail in [this behind‑the‑scenes article](https://www.gravitykit.com/translating-wordpress-plugins-using-chatgpt/).

While [`gpt-po`](https://github.com/ryanhex53/gpt-po) helped us get started, we needed smarter retry logic, cost controls, and better visibility into large jobs, among other things. **Potomatic** delivers those improvements and more, as well adds fine‑grained prompt tuning through a built‑in [A/B testing utility](#ab-testing-for-prompt-optimization).

## Disclaimer

Translation quality varies depending on factors such as model selection, prompt design, and the complexity of the source text. **Potomatic** can generate a baseline translation, but the output should always be reviewed and verified before use.

For improved results, consider refining your prompt, using a higher-tier model, or consulting a professional translator to ensure accuracy and quality.

---

## Table of Contents

* [Key Features](#key-features)
* [Prerequisites](#prerequisites)
* [Setup](#setup)
* [Quick Usage](#quick-usage)
* [User Dictionaries](#user-dictionaries)
* [Example Commands](#example-commands)
  * [Dry‑run (no API calls)](#dryrun-no-api-calls)
  * [Cost and string limits](#cost-and-string-limits)
  * [Advanced options](#advanced-options)
  * [WordPress plugin](#wordpress-plugin)
  * [JSON output](#json-output)
* [CLI Options Reference](#cli-options-reference)
* [Supported Languages](#supported-languages)
* [Configuration Files](#configuration-files)
* [Available Scripts](#available-scripts)
* [A/B Testing for Prompt Optimization](#ab-testing-for-prompt-optimization)
* [Acknowledgments](#acknowledgments)

---

## Key Features

* **AI‑powered translations** – Translate into any language supported by OpenAI models.
* **Smart batch handling** – Tune batch size, concurrency and retries for the right balance of cost and speed.
* **Cost‑conscious execution** – Accurately estimate costs and tokens, and control the maximum cost of a job.
* **Incremental & resumable workflows** – Resume interrupted jobs, merge with existing `.po` files, or force a re‑translation.
* **Custom dictionaries** – Supply term mappings for consistent brand and technical vocabulary.
* **Plural‑forms support** – Automatic plural rules for languages that require different word forms based on quantity.
* **Dry‑run mode** – Preview translations and cost without making API calls.
* **Detailed progress tracking** – Real‑time stats with four verbosity levels.
* **Flexible output** – Console or JSON, with optional raw API logs for debugging.
* **Everything is a flag** – Every knob exposed via CLI flags *and* env vars.

---

## Prerequisites

Before using **Potomatic**, you need a `.pot` file containing the source strings to translate.

### Creating a POT file

**For WordPress plugin/theme authors**: Use [WP-CLI's i18n command](https://developer.wordpress.org/cli/commands/i18n/make-pot/):

```bash
wp i18n make-pot /path/to/your-plugin /path/to/your-plugin/languages/your-plugin.pot
```

**For non-WordPress projects**: Use [gettext](https://www.gnu.org/software/gettext/) tools to extract strings from your source code:

```bash
# For Python projects (using _() or gettext() functions)
xgettext --language=Python --keyword=_ --keyword=gettext --output=translations.pot *.py

# For JavaScript/Node.js projects
xgettext --language=JavaScript --keyword=_ --keyword=gettext --output=translations.pot *.js

# For PHP projects (specify which functions to extract)
xgettext --language=PHP --keyword=__ --keyword=_e --keyword=_n:1,2 --output=translations.pot *.php

# For multiple file types in a directory
find . -iname "*.php" -o -iname "*.js" -o -iname "*.py" | xgettext --files-from=- --output=translations.pot
```

**Note**: The `--keyword` option tells xgettext which function names to look for when extracting translatable strings. Common options include `_()`, `gettext()`, `__()`, `_e()`, and `_n()` depending on your framework.

These tools will scan your project and extract all translatable strings into a POT file that **Potomatic** can then use to generate translations.

---

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **(Optional) Create a `.env` file** for convenience:

```bash
# Copy the template and customize it
cp .env.example

# Or create manually with your settings
echo "OPENAI_API_KEY=your-api-key-here" > .env
echo "TARGET_LANGUAGES=fr_FR,es_ES" >> .env
echo "POT_FILE_PATH=path/to/your/file.pot" >> .env
```

**Note**: All settings can be provided via CLI arguments.

3. **Run**

```bash
./potomatic
# or
npm run translate
```

---

## Quick Usage

```bash
# Translate French and Spanish using defaults (provider auto-detected from OPENAI_API_KEY)
./potomatic -l fr_FR,es_ES -p translations.pot -k $OPENAI_API_KEY

# Use Gemini (provider auto-detected from GEMINI_API_KEY)
export GEMINI_API_KEY=your-gemini-key
./potomatic -l fr_FR,es_ES -p translations.pot

# Preview only (no API calls, cost estimate shown)
./potomatic --dry-run -l fr_FR -p translations.pot
```

---

## User Dictionaries

Custom dictionaries are supported to maintain consistency in the translation of brand names, technical terms, domain-specific language, etc.

### File layout

```
config/
└─ dictionaries/
   ├─ dictionary.json          # fallback for every language
   ├─ dictionary-fr.json       # language fallback
   └─ dictionary-fr-fr.json    # exact locale match
```

Each dictionary file is a plain JSON object:

```json
{
  "WordPress": "WordPress",
  "Gravity Forms": "Gravity Forms",
  "REST API": "REST API",
  "Block Editor": "Block Editor",
  "Multisite": "Multisite"
}
```

Using this example, "Block Editor" and other terms will not be translated to target language(s).

### CLI switches

| Flag                      | Env               | Description                     | Default                 |
| ------------------------- | ----------------- | ------------------------------- | ----------------------- |
| `--dictionary-path <dir>` | `DICTIONARY_PATH` | Directory with dictionary files | `./config/dictionaries` |
| `--use-dictionary`        | `USE_DICTIONARY`  | Enable dictionary system        | disabled                |

```bash
./potomatic -l fr_FR -p translations.pot --use-dictionary --dictionary-path ./my-dicts
```

---

## Example Commands

### Dry‑run (no API calls)

```bash
./potomatic --dry-run -l fr_FR -p translations.pot
./potomatic --dry-run -l fr_FR,es_ES -p translations.pot --max-strings-per-job 10
```

### Cost and string limits

```bash
./potomatic -l fr_FR,es_ES -p translations.pot --max-cost 1.00
./potomatic -l fr_FR -p translations.pot --max-strings-per-job 50
./potomatic -l fr_FR,es_ES,de_DE -p translations.pot --max-total-strings 150
./potomatic -l fr_FR,es_ES,de_DE -p translations.pot --max-total-strings 150 --max-strings-per-job 20 --max-cost 1.00
```

### Advanced options

```bash
# Larger batches, more parallelism
./potomatic -l fr_FR -p translations.pot --batch-size 30 --jobs 3

# Force overwrite existing translations
./potomatic -l fr_FR -p translations.pot --force-translate

# Merge with an existing .po file
./potomatic -l fr_FR -p translations.pot --input-po-path existing.po

# Custom output directory, prefix, and locale format (this will save "output/app-fr_FR.po")
./potomatic -l fr_FR -p translations.pot -o output/ \
  --po-file-prefix app- --locale-format wp_locale

# Verbose logging + save raw API responses
./potomatic -l fr_FR -p translations.pot --verbose-level 3 --save-debug-info
```

### WordPress plugin

```bash
# Translate a WordPress plugin using a .pot file and save translations to `languages/`
./potomatic \
  --target-languages fr_FR,es_ES \
  --pot-file-path translations.pot \
  --output-dir languages/ \
  --po-file-prefix your-plugin-text-domain-
```

### JSON output

```bash
./potomatic -l fr_FR -p translations.pot --output-format json
./potomatic -l fr_FR -p translations.pot --output-format json --output-file results.json
```

---

## CLI Options Reference

### Required Options

| Option                           | Short | Description                                                     | Default |
| -------------------------------- | ----- | --------------------------------------------------------------- | ------- |
| `--target-languages <languages>` | `-l`  | Target language codes, comma-separated. **Accepts multiple formats**: WordPress locale (`fr_FR`, `es_ES`), ISO 639-1 (`fr`, `es`), ISO 639-2 (`fra`, `spa`), or language names (`French`, `Spanish`). See [supported languages](#supported-languages) below. | -       |
| `--pot-file-path <path>`         | `-p`  | Path to the input `.pot` file containing source strings         | -       |
| `--api-key <key>`                | `-k`  | Provider API key (5-tier precedence: CLI > `POTOMATIC_<PROVIDER>_API_KEY` > `<PROVIDER>_API_KEY` > `POTOMATIC_API_KEY` > `API_KEY`) | -       |

### Provider Settings

| Option                | Short | Description                                                                                                                                           | Default  |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--provider <name>`   | -     | AI provider (e.g., "openai", "gemini", "anthropic"). **Auto-detected from API key** if not specified (e.g., `GEMINI_API_KEY` → provider=gemini). | Auto-detected or `openai` |

**Provider auto-detection precedence**: `--provider` flag > `PROVIDER` env var > auto-detected from key name > default (`openai`)

### Model Settings

| Option                     | Short | Description                                                                           | Default         |
| -------------------------- | ----- | ------------------------------------------------------------------------------------- | --------------- |
| `--model <model>`          | `-m`  | AI model name (e.g., "gpt-4o-mini")                                                  | `gpt-4o-mini`   |
| `--temperature <number>`   | -     | Creativity level (0.0-2.0); lower = more deterministic, higher = more creative        | `0.7`           |
| `--max-tokens <number>`    | -     | Maximum completion tokens for AI responses (1-32768, auto-calculated if not set)      | Auto-calculated |
| `--source-language <lang>` | `-s`  | Source language code (default: "en")                                                  | `en`            |

### File Output Settings

| Option                      | Short | Description                                                                                                            | Default       |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--output-dir <path>`       | `-o`  | Directory to save generated `.po` files for each language                                                              | `.`           |
| `--output-format <format>`  | -     | Output format: `console` or `json` (default: console)                                                                  | `console`     |
| `--output-file <path>`      | -     | Path to save JSON output (use stdout if not provided)                                                                  | -             |
| `--po-file-prefix <prefix>` | -     | Prefix for each output `.po` file (e.g., "app-" → "app-fr_FR.po")                                                      | -             |
| `--locale-format <format>`  | -     | **Controls output filename format only** (not input). Options: `wp_locale` (ru_RU), `iso_639_1` (ru), `iso_639_2` (rus), or `target_lang` (uses input format as-is) | `target_lang` |

### Translation Behavior

| Option                   | Short | Description                                                   | Default |
| ------------------------ | ----- | ------------------------------------------------------------- | ------- |
| `--force-translate`      | `-F`  | Re-translate all strings, ignoring any existing translations  | `false` |
| `--input-po-path <path>` | -     | Path to an existing `.po` file to use as a base for merging   | -       |
| `--dictionary-path <path>` | -     | Directory containing dictionary files for consistent translations | `./config/dictionaries` |
| `--use-dictionary`       | -     | Use the dictionary system for consistent translations         | `false` |

### Configuration Files

| Option                              | Short | Description                                                                     | Default                  |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------- | ------------------------ |
| `--prompt-file-path <path>`         | -     | Path to the prompt.md file containing translation instructions                 | `./config/prompt.md`     |
| `--po-header-template-path <path>`  | -     | Path to the po-header.json file containing custom PO file headers              | `./config/po-header.json`|

### Performance & Concurrency

| Option                  | Short | Description                                                                                                    | Default |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------- | ------- |
| `--batch-size <number>` | `-b`  | Number of strings per translation batch (1-100). Larger batches reduce cost but increase risk of API failures. | `20`    |
| `--jobs <number>`       | `-j`  | Maximum number of languages to translate in parallel (1-10)                                                    | `2`     |
| `--timeout <number>`    | -     | Timeout for API requests in seconds (10-300)                                                                   | `60`    |

### Processing Limits

| Option                           | Short | Description                                                                             | Default |
| -------------------------------- | ----- | --------------------------------------------------------------------------------------- | ------- |
| `--max-strings-per-job <number>` | -     | Limit the number of strings translated per language (for testing)                      | -       |
| `--max-total-strings <number>`   | -     | Limit total number of strings translated across all languages (processed sequentially) | -       |
| `--max-cost <number>`            | -     | Limit total estimated translation cost in USD                                           | -       |

### Error Handling & Retries

| Option                        | Short | Description                                                                        | Default |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------- | ------- |
| `--max-retries <number>`      | -     | Number of retry attempts per batch (0-10)                                         | `3`     |
| `--retry-delay <number>`      | -     | Delay between retry attempts in milliseconds (500-30000)                          | `2000`  |
| `--abort-on-failure`          | -     | Abort the entire translation run if any batch fails all retry attempts            | `false` |
| `--skip-language-on-failure`  | -     | Skip current language on failure and continue with remaining languages            | `false` |

### Development & Debugging

| Option                    | Short | Description                                                                                    | Default |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------- | ------- |
| `--verbose-level <level>` | `-v`  | Verbosity level: 0=errors, 1=normal, 2=verbose, 3=debug                                       | `1`     |
| `--dry-run`               | -     | Simulate translation without making actual API calls                                           | `false` |
| `--save-debug-info`       | -     | Save detailed request/response logs to timestamped files in the `debug/` directory             | `false` |

### Testing & Simulation

| Option                             | Short | Description                                                                | Default |
| ---------------------------------- | ----- | -------------------------------------------------------------------------- | ------- |
| `--test-retry-failure-rate <rate>` | -     | [Testing] Simulate API failure rate (0.0-1.0) to test retry logic         | -       |
| `--test-allow-complete-failure`    | -     | [Testing] Allow complete failure of a batch (disables final fallback)     | `false` |

### General

| Option      | Short | Description               | Default |
| ----------- | ----- | ------------------------- | ------- |
| `--version` | `-V`  | Output the version number | -       |
| `--help`    | `-h`  | Display help for command  | -       |

**Note**: All options can also be set via environment variables. Environment variable names typically match the CLI option names in UPPER_CASE format (e.g., `--max-cost` becomes `MAX_COST`, `--retry-delay` becomes `RETRY_DELAY`).

---

## Supported Languages

**Potomatic** supports a wide range of languages (including regional variants) and accepts multiple input formats. You can specify target languages using any of the following formats:

### Input Formats (for `--target-languages`)

- **WordPress locale format**: `fr_FR`, `es_ES`, `de_DE`, `pt_BR`, `zh_CN`
- **ISO 639-1 codes** (2-letter): `fr`, `es`, `de`, `pt`, `zh`
- **ISO 639-2 codes** (3-letter): `fra`, `spa`, `deu`, `por`, `zho`
- **BCP-47 format** (with dash): `fr-FR`, `es-ES`, `de-DE`
- **Language names**: `French`, `Spanish`, `German`, `Portuguese`, `Chinese`

**Example**: All of the following specify French:
```bash
./potomatic -l fr_FR -p translations.pot
./potomatic -l fr -p translations.pot
./potomatic -l fra -p translations.pot
./potomatic -l "French" -p translations.pot
```

### Output Formats (for `--locale-format`)

Control how language codes appear in output filenames:

- `target_lang` (default): Uses the format you provided (e.g., `fr` → `fr.po`, `fr_FR` → `fr_FR.po`)
- `wp_locale`: WordPress format with region (e.g., `fr_FR.po`, `es_ES.po`)
- `iso_639_1`: 2-letter ISO codes (e.g., `fr.po`, `es.po`)
- `iso_639_2`: 3-letter ISO codes (e.g., `fra.po`, `spa.po`)

### Complete Language List

For a full list of supported languages and their corresponding codes, see the [language mapping reference](src/utils/languageMapping.js). The mappings are based on [GlotPress locale data](https://github.com/GlotPress/GlotPress/blob/develop/locales/locales.php) from WordPress.org's translation platform.

**Major supported languages include**: Afrikaans, Arabic (multiple variants), Bengali, Chinese (Simplified/Traditional), Czech, Danish, Dutch, English (multiple variants), French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Persian, Polish, Portuguese (Brazil/Portugal), Romanian, Russian, Spanish (multiple variants), Swedish, Thai, Turkish, Ukrainian, Vietnamese, and more.

---

## Configuration Files

**Potomatic** uses several configuration files in the `config/` directory to customize its behavior:

### `config/dictionaries/`

Used by default to locate [user dictionary](#-user-dictionaries) files. You can change the path to the dictionary files using the `--dictionary-path` option.

### `config/prompt.md`

Contains the system prompt sent to the AI provider for translation. You may consider modifying it to adjust translation style or add domain-specific instructions.

You can override the default path using the `--prompt-file-path` CLI option or the `PROMPT_FILE_PATH` environment variable.

### `config/po-header.json`

Defines custom headers for generated `.po` files. These headers contain metadata about the translation project.

You can override the default path using the `--po-header-template-path` CLI option or the `PO_HEADER_TEMPLATE_PATH` environment variable.

**How it works:**

1. Starts with headers from the source `.pot` file
2. Applies your custom headers from this file
3. When merging with existing `.po` files, preserves custom headers from the existing file
4. **Always overwrites these headers** (regardless of what's in POT/config/existing files):
   - `Language`: Set to target language (e.g., `fr_FR`)
   - `PO-Revision-Date`: Set to current timestamp
   - `Plural-Forms`: Set to language-specific plural rules (e.g., Arabic gets 6 forms, Polish gets 3 forms)
5. **Sets `Plural-Forms` only for new files** (preserves existing PO file values when merging)

**Note**: `{{LANGUAGE}}` can be used in the custom headers to insert the target language code.

**Example custom header file:**

```json
{
	"Project-Id-Version": "MyApp 1.0",
	"Report-Msgid-Bugs-To": "support@myapp.com",
	"Last-Translator": "MyApp Team <team@myapp.com>",
	"Language-Team": "{{LANGUAGE}} Team <{{LANGUAGE}}@myapp.com>",
	"X-Generator": "MyApp Automated Translations"
}
```

**Note**: When merging with existing `.po` files, custom headers like `Project-Id-Version` from the existing file are preserved, while `Language`, `PO-Revision-Date`, and `Plural-Forms` are updated to current values. The tool automatically handles complex plural forms for languages like Arabic (6 forms), Polish/Russian/Croatian (3 forms), and others.

### `config/openai-pricing.json`

Contains pricing information for OpenAI models (as of May 2025) used for cost estimation. This file is automatically loaded and used to calculate translation costs.

---

## Available Scripts

```bash
npm run translate      # Main translation task
npm run ab-prompt-test # Prompt A/B tester
```

---

## A/B Testing for Prompt Optimization

`npm run ab-prompt-test` (or `node tools/ab-prompt-test`) runs two prompt strategies side by side, reports cost, and highlights divergent translations so you can pick the winner.

---

## Acknowledgments

Hat tip to [ryanhex53](https://github.com/ryanhex53) for the original [gpt-po](https://github.com/ryanhex53/gpt-po) that inspired this project.

# Simplified Technical English style guide

Use ASD-STE100 Simplified Technical English (STE) Issue 9 for all repository
documentation. This rule applies to Markdown files in the repository root,
`.github/`, and `docs/`.

The [official ASD-STE100 Issue 9 standard](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
is the source for STE rules and its controlled dictionary. This guide gives the
local rules for software documentation.

## Technical terms

Software documentation needs terms that are not in the STE dictionary. Treat
these items as technical nouns or technical verbs:

- Product names, library names, and service names
- File names, paths, commands, code symbols, and data fields
- UI labels and exact messages
- Software actions that have one clear meaning in this repository

Put exact commands, paths, symbols, labels, and messages in code formatting.
Use the same term for the same item in all documents.

## Words and grammar

- Use approved STE words when a clear approved word is available.
- Use each word with one meaning and one part of speech.
- Use American English spelling.
- Use active voice when you know the person or system that does the action.
- Use simple verb forms.
- Use an `-ing` form only in an approved word or a technical noun.
- Do not use a contraction.
- Use `must` for a requirement.
- Use `can` for an ability or a permitted action.
- Use `may` only for a possible result.
- Do not use `should` or `shall`.
- Do not use a phrasal verb when one clear verb has the same meaning.
- Do not use a pronoun when its noun is not clear.
- Put a noun after `this`, `that`, `these`, or `those` when ambiguity is
  possible.

## Sentences and paragraphs

- Write one subject in each sentence.
- Use no more than 25 words in a descriptive sentence.
- Use no more than 20 words in an instruction.
- Write one instruction in each step.
- Start an instruction with an imperative verb.
- Put a condition before the instruction when the reader must know the
  condition first.
- Use a vertical list for complex information.
- Keep one topic in each paragraph.
- Use no more than six sentences in a paragraph.

## Punctuation and structure

- Do not use a semicolon.
- Use a colon before a vertical list.
- Use parentheses only for references, identifiers, abbreviations,
  alternatives, or short explanations.
- Define an abbreviation at its first use unless it is a code symbol or a
  familiar technical term.
- Use direct headings that identify the section topic.
- Keep list items grammatically consistent.

## Procedures

Use this sequence for a procedure:

1. Give prerequisites before the steps.
2. Start each step with one command.
3. Put one action in each step.
4. Give the expected result after the command.
5. Put information in a note only when the information is not an instruction.

Example:

1. Run `bun run docs:check`.
2. Correct each reported error.
3. Run the command again.

## Automated check

Run this command after a documentation change:

```bash
bun run docs:check
```

The check examines sentence length, paragraph length, contractions,
semicolons, and selected non-STE wording. It ignores code blocks and inline
code.

The check cannot prove full STE conformance. Review these items manually:

- The approved meaning and part of speech for general words
- The classification and consistent use of technical terms
- Active voice
- One subject in each sentence
- One instruction in each procedure step
- Clear noun references for pronouns

## Review checklist

1. Run `bun run docs:check`.
2. Confirm that all changed terms have one meaning.
3. Confirm that all instructions use active, imperative verbs.
4. Confirm that each sentence has one subject.
5. Confirm that all code examples and links are accurate.

# Readability estimates

The optional panel remains inside Check a text > More text details. It reports the
existing Flesch Reading Ease and Flesch–Kincaid U.S. grade estimate. It does not
select teaching words, change the wordlist, grade a learner, or assign a Hong Kong
curriculum level.

## Formulas and sources

With ASL = English word occurrences / sentence spans and ASW = estimated syllables /
English word occurrences:

- Flesch Reading Ease = 206.835 - 1.015 ASL - 84.6 ASW.
- Flesch–Kincaid grade = 0.39 ASL + 11.8 ASW - 15.59.

References:

- Flesch, R. (1948). A new readability yardstick. Journal of Applied Psychology,
  32(3), 221–233. https://doi.org/10.1037/h0057532
- Kincaid, J. P., Fishburne, R. P., Rogers, R. L., & Chissom, B. S. (1975).
  Derivation of new readability formulas for Navy enlisted personnel. Research
  Branch Report 8-75. https://doi.org/10.21236/ADA006655
- Formula cross-check: https://quanteda.io/reference/textstat_readability.html
- Reader/task context: https://www.thecorestandards.org/ELA-Literacy/standard-10-range-quality-complexity/measuring-text-complexity-three-factors/

## Local counting implementation (2026-10-28)

This small, deterministic estimator has no new dependency, network request or
large pronunciation dictionary. English word occurrences still come from the
existing text-check token stream. Changes are limited to readability processing:

- Preserve pronounced -ed and -es syllables, silent-e/syllabic-le distinctions,
  common vowel hiatus, and a small explicit exception list for classroom words.
- Protect decimal dots, common titles and abbreviations, initials and addresses
  when counting sentence spans. Soft line wraps do not create sentences; blank
  paragraph breaks can separate unpunctuated spans.
- Keep the existing 30-word display minimum. This is a product safeguard, not a
  validated minimum sample size or a promise that a 30-word score is stable.
- Preserve the published coefficients and raw results; do not clamp scores into
  an invented range or convert the result to a Hong Kong grade.

The regression examples use independently specified pronunciation/sentence
counts and hand-calculated formula outputs. They establish those cases only.
The counting rules are engineering approximations, not a new research-validated
readability model. Names, variable pronunciations, complex abbreviations, mixed
languages, OCR errors and unusual layouts can still affect estimates. The two
formulas share the same inputs; they are not independent assessments.

Use as an optional comparison of passage wording, alongside teacher knowledge of
the class, HK-ELE word evidence, subject knowledge and lesson tasks. This change
does not establish predictive validity for Hong Kong pupils or learning effects.

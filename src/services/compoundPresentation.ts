import type { SupplementaryExpression } from "../domain/supplementaryExpressions";

/** Show only linked components, never an unowned spelling or the whole word itself. */
export function compoundDisplayParts(expression: SupplementaryExpression) {
  const normalize = (word: string) => word.normalize("NFKC").trim().toLowerCase();
  const whole = normalize(expression.normalizedExpression);
  return (expression.parts ?? []).filter(
    (part) => Boolean(part.familyKey) && normalize(part.form) !== whole,
  );
}

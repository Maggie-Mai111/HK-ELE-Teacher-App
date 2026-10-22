import type { SupplementaryExpression } from "../domain/supplementaryExpressions";
import type { TeachingListItem } from "../domain/teachingList";
import { COMPOUND_RELEASE } from "./compoundData";
export const expressionItemKey = (expression: SupplementaryExpression) =>
  "expression:" + expression.expressionId;
export function createCompoundTeachingItem(
  expression: SupplementaryExpression,
  order: number,
  source = "Find words",
): TeachingListItem {
  const now = new Date().toISOString();
  return {
    recordType: "compound",
    expression,
    basewordKey: expressionItemKey(expression),
    displayFamily: expression.displayExpression,
    selectedForms: [expression.displayExpression],
    status: "Notice",
    notes: "",
    connections: "",
    customOrder: order,
    addedAt: now,
    updatedAt: now,
    sourceLabels: [source],
    dataVersion: COMPOUND_RELEASE.dataVersion,
    derived: {
      set_membership: null,
      overall_frequency_order: null,
      current_hk_frequency_rank: null,
      current_hk_frequency_band: null,
      textbook_first_seen_level: null,
      external_level_reference_display: null,
    },
  };
}
export function refreshCompoundTeachingItem(
  item: TeachingListItem,
  expression: SupplementaryExpression | null,
): TeachingListItem {
  if (
    !expression ||
    item.basewordKey !== expressionItemKey(expression) ||
    item.expression?.normalizedExpression !== expression.normalizedExpression
  )
    return {
      ...item,
      dataReviewStatus: "Saved compound kept — update the wordlist to check its details.",
    };
  return { ...item, expression, dataReviewStatus: undefined };
}

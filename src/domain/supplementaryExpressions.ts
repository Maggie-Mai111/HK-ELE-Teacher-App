/** A separate data layer: expression records never invent a ranked family owner. */
export interface SupplementaryExpression {
  expressionId: string;
  displayExpression: string;
  normalizedExpression: string;
  kind: "COMPOUND";
  sourceVersion: string;
  componentFamilyKeys: readonly string[] | null;
  componentMappingStatus: "VERIFIED" | "UNOWNED" | "AMBIGUOUS" | "NOT_PROVIDED";
}
export interface ExpressionLayerDescriptor {
  schemaVersion: "1.0.0";
  productDataVersion: string;
  expressionDataVersion: string;
  sourceSha256: string;
  normalizationPolicyId: string;
  matchingPolicyId: string;
  records: number;
}
export type SupplementaryExpressionLookup =
  | { status: "EXPRESSION_LAYER_UNAVAILABLE" }
  | { status: "NO_REGISTERED_EXPRESSION"; expressionDataVersion: string }
  | { status: "MATCHED_EXPRESSION"; expression: SupplementaryExpression };
export interface ExpressionDataSource {
  descriptor: ExpressionLayerDescriptor;
  lookupExact(normalizedExpression: string): Promise<SupplementaryExpression | null>;
}
export async function lookupSupplementaryExpression(
  source: ExpressionDataSource | null,
  normalizedExpression: string,
  productDataVersion: string,
): Promise<SupplementaryExpressionLookup> {
  if (!source) return { status: "EXPRESSION_LAYER_UNAVAILABLE" };
  if (
    source.descriptor.schemaVersion !== "1.0.0" ||
    source.descriptor.productDataVersion !== productDataVersion
  )
    throw new Error("Expression layer is incompatible with this data release.");
  const expression = await source.lookupExact(normalizedExpression);
  if (!expression)
    return {
      status: "NO_REGISTERED_EXPRESSION",
      expressionDataVersion: source.descriptor.expressionDataVersion,
    };
  if (
    expression.normalizedExpression !== normalizedExpression ||
    expression.sourceVersion !== source.descriptor.expressionDataVersion ||
    expression.kind !== "COMPOUND"
  )
    throw new Error("Unregistered or inconsistent expression record.");
  return { status: "MATCHED_EXPRESSION", expression };
}

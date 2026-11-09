import { Text } from "react-native";
import { colors } from "../theme/tokens";

// Emphasise exactly the occurrence being judged, including repeated spellings nearby.
export function MarkedContext({ excerpt }: { excerpt: { before: string; word: string; after: string } }) {
  return <>{excerpt.before}<Text style={{ fontWeight: "800", backgroundColor: colors.primarySoft }}>{excerpt.word}</Text>{excerpt.after}</>;
}

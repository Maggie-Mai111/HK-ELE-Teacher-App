import { Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface Props {
  onTokenChange: (token: string | null) => void;
  resetNonce: number;
}

export function TurnstileGate({ onTokenChange }: Props) {
  void onTokenChange;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        Native AI is not enabled in this release. Existing non-AI native features remain available.
      </Text>
    </View>
  );
}

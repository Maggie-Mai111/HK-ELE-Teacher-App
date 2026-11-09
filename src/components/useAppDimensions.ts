import { Platform, useWindowDimensions } from "react-native";

// The PWA stays a phone interface when opened on a desktop; real phone widths stay unchanged.
export function useAppDimensions() {
  const window = useWindowDimensions();
  return { ...window, phonePreview: Platform.OS === "web" && window.width >= 760, width: Platform.OS === "web" && window.width >= 760 ? 390 : window.width };
}

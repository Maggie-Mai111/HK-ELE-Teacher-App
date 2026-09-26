import { useMemo, useState } from "react";
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";

import { NavigationBar, type AppRoute } from "./src/components/NavigationBar";
import { repository } from "./src/data/repository";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { CheckTextScreen } from "./src/screens/CheckTextScreen";
import { DataVersionScreen } from "./src/screens/DataVersionScreen";
import { TeachingListScreen } from "./src/screens/TeachingListScreen";
import { WordDetailScreen } from "./src/screens/WordDetailScreen";
import { useTeachingList } from "./src/services/teachingListService";
import { colors } from "./src/theme/tokens";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("browse");
  const [detail, setDetail] = useState<{
    basewordKey: string;
    previousRoute: AppRoute;
    textEvidence?: { members: Array<{ surface: string; count: number }>; count: number };
  } | null>(null);
  const appRepository = useMemo(() => repository, []);
  const teaching = useTeachingList(appRepository);
  const openFamily = (
    basewordKey: string,
    textEvidence?: { members: Array<{ surface: string; count: number }>; count: number },
  ) =>
    setDetail({
      basewordKey,
      previousRoute: route,
      ...(textEvidence ? { textEvidence } : {}),
    });
  const navigate = (next: AppRoute) => {
    setDetail(null);
    setRoute(next);
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <View style={styles.app}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
        >
          <View style={styles.page}>
            {detail ? (
              <WordDetailScreen
                basewordKey={detail.basewordKey}
                onBack={() => {
                  setRoute(detail.previousRoute);
                  setDetail(null);
                }}
                repository={appRepository}
                teaching={teaching}
                {...(detail.textEvidence ? { textEvidence: detail.textEvidence } : {})}
              />
            ) : route === "browse" ? (
              <BrowseScreen
                onOpenFamily={openFamily}
                repository={appRepository}
                teaching={teaching}
              />
            ) : route === "check" ? (
              <CheckTextScreen
                onOpenFamily={openFamily}
                repository={appRepository}
                teaching={teaching}
              />
            ) : route === "list" ? (
              <TeachingListScreen onOpenFamily={openFamily} teaching={teaching} />
            ) : (
              <DataVersionScreen repository={appRepository} />
            )}
          </View>
        </ScrollView>
        <NavigationBar activeRoute={route} onNavigate={navigate} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { backgroundColor: colors.canvas, flex: 1 },
  page: { alignSelf: "center", maxWidth: Platform.OS === "web" ? 1440 : 760, width: "100%" },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});

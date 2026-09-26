import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";

import { NavigationBar, type AppRoute } from "./src/components/NavigationBar";
import { AppMenu } from "./src/components/AppMenu";
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
  const scrollRef = useRef<ScrollView>(null);
  const scrollPositions = useRef<Record<AppRoute, number>>({
    browse: 0,
    check: 0,
    list: 0,
    data: 0,
  });
  const openFamily = (
    basewordKey: string,
    textEvidence?: { members: Array<{ surface: string; count: number }>; count: number },
  ) => {
    setDetail({
      basewordKey,
      previousRoute: route,
      ...(textEvidence ? { textEvidence } : {}),
    });
  };
  const navigate = (next: AppRoute) => {
    setDetail(null);
    setRoute(next);
  };

  useEffect(() => {
    const target = detail ? 0 : scrollPositions.current[route];
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [detail, route]);

  const screenVisibility = (screen: AppRoute) => ({
    accessibilityElementsHidden: Boolean(detail) || route !== screen,
    importantForAccessibility:
      Boolean(detail) || route !== screen ? ("no-hide-descendants" as const) : ("auto" as const),
    pointerEvents: Boolean(detail) || route !== screen ? ("none" as const) : ("auto" as const),
    style: Boolean(detail) || route !== screen ? styles.hiddenScreen : styles.activeScreen,
  });
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <View style={styles.app}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            if (!detail) scrollPositions.current[route] = event.nativeEvent.contentOffset.y;
          }}
          ref={scrollRef}
          scrollEventThrottle={32}
          style={styles.scroll}
        >
          <View style={styles.page}>
            <AppMenu onOpenAbout={() => navigate("data")} />
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
            ) : null}
            <View {...screenVisibility("browse")}>
              <BrowseScreen
                onOpenFamily={openFamily}
                repository={appRepository}
                teaching={teaching}
              />
            </View>
            <View {...screenVisibility("check")}>
              <CheckTextScreen
                onOpenFamily={openFamily}
                repository={appRepository}
                teaching={teaching}
              />
            </View>
            <View {...screenVisibility("list")}>
              <TeachingListScreen
                onFindWords={() => navigate("browse")}
                onOpenFamily={openFamily}
                teaching={teaching}
              />
            </View>
            <View {...screenVisibility("data")}>
              <DataVersionScreen repository={appRepository} />
            </View>
          </View>
        </ScrollView>
        <NavigationBar activeRoute={route} onNavigate={navigate} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeScreen: { display: "flex" },
  app: { backgroundColor: colors.canvas, flex: 1 },
  hiddenScreen: { display: "none" },
  page: { alignSelf: "center", maxWidth: Platform.OS === "web" ? 1440 : 760, width: "100%" },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});

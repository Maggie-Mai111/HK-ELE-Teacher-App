import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

import { NavigationBar, type AppRoute } from "./src/components/NavigationBar";
import { AppMenu } from "./src/components/AppMenu";
import { FeedbackPanel, type FeedbackRequest } from "./src/components/FeedbackPanel";
import { PrivacyPanel } from "./src/components/PrivacyPanel";
import {
  consentChoice,
  PRIVACY_STORAGE_KEY,
  validConsentChoice,
} from "./src/services/privacyPreferences";
import { repository } from "./src/data/repository";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { CheckTextScreen } from "./src/screens/CheckTextScreen";
import { DataVersionScreen } from "./src/screens/DataVersionScreen";
import { TeachingListScreen } from "./src/screens/TeachingListScreen";
import { WordDetailScreen } from "./src/screens/WordDetailScreen";
import { useTeachingList } from "./src/services/teachingListService";
import { colors } from "./src/theme/tokens";

export default function App() {
  const [feedbackRequest, setFeedbackRequest] = useState<FeedbackRequest | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(true);
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PRIVACY_STORAGE_KEY)
      .then((raw) => {
        let valid = false;
        try {
          valid = validConsentChoice(raw ? JSON.parse(raw) : null);
        } catch {
          /* Show notice again. */
        }
        if (active) {
          setFirstVisit(!valid);
          setPrivacyOpen(!valid);
          setPrivacyReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setPrivacyOpen(true);
          setPrivacyReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const closePrivacy = () => {
    if (firstVisit || privacyBusy) return;
    setPrivacyOpen(false);
  };
  const agreePrivacy = async () => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    setPrivacyError("");
    try {
      await AsyncStorage.setItem(
        PRIVACY_STORAGE_KEY,
        JSON.stringify(consentChoice(true, new Date().toISOString())),
      );
      setDetail(null);
      setRoute("home");
      setFirstVisit(false);
      setPrivacyOpen(false);
    } catch {
      setPrivacyError("Your choice could not be saved. Please allow device storage and try again.");
    } finally {
      setPrivacyBusy(false);
    }
  };
  const withdrawPrivacy = async () => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    setPrivacyError("");
    try {
      await AsyncStorage.removeItem(PRIVACY_STORAGE_KEY);
      setFeedbackRequest(null);
      setFirstVisit(true);
      setPrivacyOpen(true);
    } catch {
      setPrivacyError("Your choice could not be changed. Please try again.");
    } finally {
      setPrivacyBusy(false);
    }
  };
  const [route, setRoute] = useState<AppRoute>("home");
  const [detail, setDetail] = useState<{
    basewordKey: string;
    previousRoute: AppRoute;
    textEvidence?: { members: Array<{ surface: string; count: number }>; count: number };
  } | null>(null);
  const appRepository = useMemo(() => repository, []);
  const teaching = useTeachingList(appRepository);
  const scrollRef = useRef<ScrollView>(null);
  const scrollPositions = useRef<Record<AppRoute, number>>({
    home: 0,
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
        {privacyReady && !firstVisit ? (
          <>
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
                <AppMenu
                  onOpenAbout={() => navigate("data")}
                  onFeedback={() =>
                    setFeedbackRequest({
                      kind: "report",
                      context: {
                        product: "App/PWA",
                        page: detail
                          ? "Word detail"
                          : {
                              home: "Home",
                              browse: "Find words",
                              check: "Check a text",
                              list: "Teaching list",
                              data: "About",
                            }[route],
                      },
                    })
                  }
                  onPrivacy={() => {
                    setPrivacyError("");
                    setPrivacyOpen(true);
                  }}
                />
                {detail ? (
                  <WordDetailScreen
                    onFeedback={(request) => setFeedbackRequest(request)}
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
                <View {...screenVisibility("home")}>
                  <HomeScreen onNavigate={navigate} />
                </View>
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
            <FeedbackPanel request={feedbackRequest} onClose={() => setFeedbackRequest(null)} />
          </>
        ) : !privacyReady ? (
          <ActivityIndicator
            accessibilityLabel="Opening HK-ELE"
            style={styles.opening}
            color={colors.primary}
          />
        ) : null}
        <PrivacyPanel
          visible={privacyReady && privacyOpen}
          firstVisit={firstVisit}
          busy={privacyBusy}
          error={privacyError}
          onClose={closePrivacy}
          onAgree={() => void agreePrivacy()}
          onWithdraw={() => void withdrawPrivacy()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeScreen: { display: "flex" },
  app: { backgroundColor: colors.canvas, flex: 1 },
  opening: { flex: 1 },
  hiddenScreen: { display: "none" },
  page: { alignSelf: "center", maxWidth: Platform.OS === "web" ? 1440 : 760, width: "100%" },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});

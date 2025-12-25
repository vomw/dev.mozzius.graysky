import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { showToastable } from "react-native-toastable";
import Constants from "expo-constants";
import * as Device from "expo-device";
import {
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { AtpAgent, type AtpSessionData } from "@atproto/api";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { ThemeProvider } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ListProvider } from "~/components/lists/context";
import { StatusBar } from "~/components/status-bar";
import { type SavedSession } from "~/components/switch-accounts";
import { Toastable } from "~/components/toastable/toastable";
import I18nProvider, { initializeI18n } from "~/i18n/config";
import {
  AgentProvider,
  AuthProvider,
  defaultAgent,
  type AuthContextValue,
} from "~/lib/agent";
import { PreferencesProvider } from "~/lib/hooks/preferences";
import { CustomerInfoProvider, useConfigurePurchases } from "~/lib/purchases";
import { useQuickAction, useSetupQuickActions } from "~/lib/quick-actions";
import { useThemeSetup } from "~/lib/storage/app-preferences";
import { store } from "~/lib/storage/storage";
import { TRPCProvider } from "~/lib/utils/api";
import { isIOS26 } from "~/lib/utils/version";

const routingInstrumentation = Sentry.reactNavigationIntegration();

Sentry.init({
  enabled: !__DEV__,
  debug: false,
  // not a secret, but allow override
  dsn:
    (Constants.expoConfig?.extra?.sentry as string) ??
    "https://76421919ff114625bfd275af5f843452@o4505343214878720.ingest.sentry.io/4505478653739008",
  ignoreErrors: [
    // https://graysky.sentry.io/issues/4916862074/?project=4505478653739008&query=is%3Aunresolved&referrer=issue-stream&statsPeriod=14d&stream_index=0
    "viewNotFoundForReactTag",
    // https://graysky.sentry.io/issues/4677582595/?project=4505478653739008&query=is%3Aunresolved&referrer=issue-stream&statsPeriod=14d&stream_index=1
    "nilReactBridge",
  ],
});

const useSentryTracing = () => {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref) {
      routingInstrumentation.registerNavigationContainer(ref);
    }
  }, [ref]);
};

void SplashScreen.preventAutoHideAsync();

initializeI18n();

const App = () => {
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [agent, setAgent] = useState<AtpAgent | null>(null);
  const theme = useThemeSetup();
  const { _ } = useLingui();
  const tRef = useRef(_);
  tRef.current = _;
  const resumingRef = useRef(false);

  // Save session to storage and update saved sessions list
  const saveSessionToStorage = useCallback(
    (sess: AtpSessionData, currentAgent: AtpAgent) => {
      store.set("session", JSON.stringify(sess));
      // Update saved sessions list with profile info
      void currentAgent.getProfile({ actor: sess.did }).then((res) => {
        if (res.success) {
          const sessions = store.getString("sessions");
          const newSession: SavedSession = {
            session: sess,
            did: sess.did,
            handle: res.data.handle,
            avatar: res.data.avatar,
            displayName: res.data.displayName,
            signedOut: false,
          };
          if (sessions) {
            const old = JSON.parse(sessions) as SavedSession[];
            const newSessions = [
              newSession,
              ...old.filter((s) => s.did !== sess.did),
            ];
            store.set("sessions", JSON.stringify(newSessions));
          } else {
            store.set("sessions", JSON.stringify([newSession]));
          }
        }
      });
    },
    [],
  );

  // Create a new agent with persistSession callback
  const createAgent = useCallback(() => {
    const newAgent = new AtpAgent({
      service: "https://bsky.social",
      persistSession(evt, sess) {
        if (evt === "create" || evt === "update") {
          if (sess) {
            saveSessionToStorage(sess, newAgent);
          }
        } else if (evt === "expired") {
          store.remove("session");
          showToastable({
            message: tRef.current(
              msg`Sorry! Your session expired. Please log in again.`,
            ),
          });
          setAgent(null);
        }
      },
    });
    return newAgent;
  }, [saveSessionToStorage]);

  // Auth functions
  const login = useCallback(
    async (identifier: string, password: string, authFactorToken?: string) => {
      const newAgent = createAgent();
      await newAgent.login({ identifier, password, authFactorToken });
      setAgent(newAgent);
    },
    [createAgent],
  );

  const resumeSession = useCallback(
    async (session: AtpSessionData) => {
      const newAgent = createAgent();
      await newAgent.resumeSession(session);
      setAgent(newAgent);
    },
    [createAgent],
  );

  const logout = useCallback(() => {
    // Mark current session as signed out in saved sessions
    const currentDid = agent?.session?.did;
    if (currentDid) {
      const sessions = store.getString("sessions");
      if (sessions) {
        const old = JSON.parse(sessions) as SavedSession[];
        const newSessions = old.map((s) =>
          s.did === currentDid ? { ...s, signedOut: true } : s,
        );
        store.set("sessions", JSON.stringify(newSessions));
      }
    }
    store.remove("session");
    queryClient.clear();
    setAgent(null);
  }, [agent?.session?.did, queryClient]);

  const authValue = useMemo<AuthContextValue>(
    () => ({ login, resumeSession, logout }),
    [login, resumeSession, logout],
  );

  // Resume session on app launch
  useEffect(() => {
    if (resumingRef.current) return;
    resumingRef.current = true;

    const savedSession = getSession();
    if (savedSession) {
      resumeSession(savedSession)
        .then(() => {
          router.replace("/(feeds)/feeds");
        })
        .catch(() => {
          showToastable({
            message: tRef.current(
              msg`Sorry! Your session expired. Please log in again.`,
            ),
          });
          store.remove("session");
          router.replace("/");
        })
        .finally(() => {
          setReady(true);
        });
    } else {
      setReady(true);
    }
  }, [resumeSession, router]);

  // Redirect depending on login state
  useEffect(() => {
    if (!ready) return;
    // @ts-expect-error type is overly specific
    const atRoot = segments.length === 0;
    const inAuthGroup = segments[0] === "(auth)";

    // Never interfere with auth group - let those pages handle their own navigation
    if (inAuthGroup) return;

    // Redirect to landing if not logged in and trying to access protected routes
    if (!agent?.hasSession && !atRoot) {
      console.log("redirecting to /");
      router.replace("/");
    }
    // Redirect to feeds if at root with session (initial app launch)
    else if (agent?.hasSession && atRoot) {
      console.log("redirecting to /feeds");
      router.replace("/(feeds)/feeds");
    }
  }, [segments, router, agent?.hasSession, ready]);

  const splashscreenHidden = useRef(false);

  useEffect(() => {
    if (splashscreenHidden.current) return;
    if (ready) {
      void SplashScreen.hideAsync()
        .catch(() => console.warn)
        .then(() => Device.getDeviceTypeAsync())
        .then((type) => {
          if (type === Device.DeviceType.TABLET) {
            void ScreenOrientation.unlockAsync();
          }
        });
      splashscreenHidden.current = true;
    }
  }, [ready]);

  // needs i18n context
  useSetupQuickActions();

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={theme}>
        <StatusBar style="auto" applyToNavigationBar />
        <KeyboardProvider>
          <SafeAreaProvider>
            {agent?.hasSession && <QuickActions />}
            <CustomerInfoProvider>
              <AuthProvider value={authValue}>
                <AgentProvider value={agent ?? defaultAgent}>
                  <PreferencesProvider>
                    <ActionSheetProvider>
                      <ListProvider>
                        <Stack>
                          <Stack.Screen
                            name="index"
                            options={{
                              headerShown: false,
                              gestureEnabled: false,
                            }}
                          />
                          <Stack.Screen
                            name="(auth)"
                            options={{
                              headerShown: false,
                              presentation: "formSheet",
                              contentStyle: {
                                height: "100%",
                              },
                            }}
                          />
                          <Stack.Screen
                            name="settings"
                            options={{
                              headerShown: false,
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="codes"
                            options={{
                              headerShown: false,
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="images/[post]"
                            options={{
                              headerShown: false,
                              animation: "fade",
                              animationMatchesGesture: true,
                            }}
                          />
                          <Stack.Screen
                            name="discover"
                            options={{
                              title: _(msg`Discover Feeds`),
                              presentation: "modal",
                              headerLargeTitle: true,
                              headerLargeTitleShadowVisible: !isIOS26,
                              headerTransparent: isIOS26,
                              headerLargeStyle: {
                                backgroundColor: isIOS26
                                  ? "transparent"
                                  : theme.colors.background,
                              },
                              headerSearchBarOptions: {},
                            }}
                          />
                          <Stack.Screen
                            name="pro"
                            options={{
                              title: "",
                              headerTransparent: true,
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="circle"
                            options={{
                              title: _(msg`My Circle`),
                              headerTransparent: true,
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="success"
                            options={{
                              title: _(msg`Purchase Successful`),
                              headerShown: false,
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="composer"
                            options={{
                              headerShown: false,
                              ...Platform.select({
                                ios: {
                                  presentation: "formSheet",
                                  contentStyle: {
                                    height: "100%",
                                  },
                                },
                                android: {
                                  animation: "fade_from_bottom",
                                },
                              }),
                            }}
                          />
                          <Stack.Screen
                            name="edit-bio"
                            options={{
                              title: _(msg`Edit Profile`),
                              ...Platform.select({
                                ios: {
                                  presentation: "modal",
                                  headerTransparent: true,
                                  headerShadowVisible: true,
                                  headerBlurEffect: !isIOS26
                                    ? theme.dark
                                      ? "systemThickMaterialDark"
                                      : "systemChromeMaterialLight"
                                    : undefined,
                                  headerStyle: {
                                    backgroundColor: !isIOS26
                                      ? theme.dark
                                        ? "rgba(0,0,0,0.4)"
                                        : "rgba(255,255,255,0.1)"
                                      : undefined,
                                  },
                                },
                              }),
                            }}
                          />
                          <Stack.Screen
                            name="create-list"
                            options={{
                              title: _(msg`Create List`),
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="add-to-list/[handle]"
                            options={{
                              title: _(msg`Add to List`),
                              presentation: "modal",
                            }}
                          />
                          <Stack.Screen
                            name="push-notifications"
                            options={{
                              title: _(msg`Push Notifications`),
                              presentation: "modal",
                              headerShown: false,
                              headerTransparent: true,
                              gestureEnabled: false,
                            }}
                          />
                          <Stack.Screen
                            name="capture/[author]/[post]"
                            options={{
                              title: _(msg`Share as Image`),
                              presentation: "formSheet",
                            }}
                          />
                        </Stack>
                      </ListProvider>
                    </ActionSheetProvider>
                  </PreferencesProvider>
                </AgentProvider>
              </AuthProvider>
            </CustomerInfoProvider>
            <Toastable />
          </SafeAreaProvider>
        </KeyboardProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

const getSession = () => {
  const raw = store.getString("session");
  if (!raw) return null;
  const session = JSON.parse(raw) as AtpSessionData;
  return session;
};

function RootLayout() {
  useConfigurePurchases();
  useSentryTracing();

  return (
    <I18nProvider>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </I18nProvider>
  );
}

export default Sentry.wrap(RootLayout);

const QuickActions = () => {
  const fired = useRef<string | null>(null);
  const router = useRouter();
  const action = useQuickAction();

  const href = action?.params?.href;

  useEffect(() => {
    if (typeof href !== "string" || fired.current === href) return;
    fired.current = href;
    router.push(href);
  }, [href, router]);

  return null;
};

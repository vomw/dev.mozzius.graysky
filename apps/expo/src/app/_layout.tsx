// Polyfills must be imported first
import "~/lib/utils/polyfills/platform-polyfills";
import "abortcontroller-polyfill/dist/abortsignal-polyfill-only";

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { ThemeProvider } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ListProvider } from "~/components/lists/context";
import { StatusBar } from "~/components/status-bar";
import { Toastable } from "~/components/toastable/toastable";
import I18nProvider, { initializeI18n } from "~/i18n/config";
import { AgentProvider } from "~/lib/agent";
import { PreferencesProvider } from "~/lib/hooks/preferences";
import { LogOutProvider } from "~/lib/log-out-context";
import { getOAuthClient } from "~/lib/oauth-client";
import { CustomerInfoProvider, useConfigurePurchases } from "~/lib/purchases";
import { useQuickAction, useSetupQuickActions } from "~/lib/quick-actions";
import { SessionProvider, useSession } from "~/lib/session-provider";
import { useThemeSetup } from "~/lib/storage/app-preferences";
import { TRPCProvider } from "~/lib/utils/api";
import { isIOS26 } from "~/lib/utils/version";

// DOMException polyfill for OAuth client
globalThis.DOMException = globalThis.DOMException || Error;

const routingInstrumentation = Sentry.reactNavigationIntegration();

Sentry.init({
  enabled: !__DEV__,
  debug: false,
  dsn:
    (Constants.expoConfig?.extra?.sentry as string) ??
    "https://76421919ff114625bfd275af5f843452@o4505343214878720.ingest.sentry.io/4505478653739008",
  ignoreErrors: ["viewNotFoundForReactTag", "nilReactBridge"],
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
  const { isLoading, isLoggedIn, signOut } = useSession();
  const queryClient = useQueryClient();
  const theme = useThemeSetup();
  const { _ } = useLingui();

  // Redirect depending on login state
  useEffect(() => {
    if (isLoading) return;

    // @ts-expect-error type is overly specific
    const atRoot = segments.length === 0;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isLoggedIn && !inAuthGroup && !atRoot) {
      // Not signed in and not in auth group - redirect to root
      console.log("redirecting to /");
      router.replace("/");
    } else if (isLoggedIn && atRoot) {
      // Signed in and at root - redirect to feeds
      console.log("redirecting to /feeds");
      router.replace("/(feeds)/feeds");
    }
  }, [segments, router, isLoggedIn, isLoading]);

  const splashscreenHidden = useRef(false);

  useEffect(() => {
    if (splashscreenHidden.current) return;
    if (!isLoading) {
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
  }, [isLoading]);

  const logOut = async () => {
    await signOut();
    queryClient.clear();
  };

  // needs i18n context
  useSetupQuickActions();

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={theme}>
        <StatusBar style="auto" applyToNavigationBar />
        <KeyboardProvider>
          <SafeAreaProvider>
            {isLoggedIn && <QuickActions />}
            <CustomerInfoProvider>
              <AgentProvider>
                <PreferencesProvider>
                  <LogOutProvider value={logOut}>
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
                  </LogOutProvider>
                </PreferencesProvider>
              </AgentProvider>
            </CustomerInfoProvider>
            <Toastable />
          </SafeAreaProvider>
        </KeyboardProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

function RootLayout() {
  useConfigurePurchases();
  useSentryTracing();

  return (
    <I18nProvider>
      <TRPCProvider>
        <SessionProvider client={getOAuthClient()}>
          <App />
        </SessionProvider>
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

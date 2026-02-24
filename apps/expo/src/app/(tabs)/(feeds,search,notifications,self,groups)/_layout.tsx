import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { Trans } from "@lingui/macro";
import { jwtDecode } from "jwt-decode";
import { ErrorBoundary } from "react-error-boundary";

import { ErrorBoundary as ErrorBoundaryView } from "~/components/error-boundary";
import { WaitingRoom } from "~/components/screens/waiting-room";
import { Text } from "~/components/themed/text";
import { AbsolutePathProvider } from "~/lib/absolute-path-context";
import { useOptionalAgent } from "~/lib/agent";
import { isIOS26 } from "~/lib/utils/version";

type Segment =
  | "(feeds)"
  | "(search)"
  | "(notifications)"
  | "(self)"
  | "(groups)";

export default function SubStack({ segment }: { segment: Segment }) {
  // agent might not be available yet
  const agent = useOptionalAgent();

  // Always call hooks unconditionally
  const decodedJwt = useMemo(() => {
    if (segment === "(groups)") return "groups-bypass";
    if (!agent?.session?.accessJwt) return null;
    return jwtDecode<{ scope: string }>(agent.session.accessJwt);
  }, [agent?.session?.accessJwt, segment]);

  // Groups tab doesn't need JWT session validation
  if (segment === "(groups)") {
    return (
      <AbsolutePathProvider segment={segment}>
        <ErrorBoundary
          FallbackComponent={({ error, resetErrorBoundary }) => (
            <ErrorBoundaryView
              error={error as Error}
              retry={() => Promise.resolve(resetErrorBoundary())}
            />
          )}
        >
          <Stack
            initialRouteName="groups"
            screenOptions={{
              headerBackButtonDisplayMode: isIOS26 ? "minimal" : "default",
            }}
          />
        </ErrorBoundary>
      </AbsolutePathProvider>
    );
  }

  if (!decodedJwt) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-base">
          <Trans>Connecting...</Trans>
        </Text>
      </View>
    );
  }

  const jwt = decodedJwt as { scope: string };

  switch (jwt.scope) {
    case "com.atproto.deactivated":
      // in the queue
      return <WaitingRoom />;
    default:
      // should probably work fine
      return (
        <AbsolutePathProvider segment={segment}>
          <ErrorBoundary
            FallbackComponent={({ error, resetErrorBoundary }) => (
              <ErrorBoundaryView
                error={error as Error}
                retry={() => Promise.resolve(resetErrorBoundary())}
              />
            )}
          >
            <Stack
              initialRouteName={getInitialRouteName(segment)}
              screenOptions={{
                headerBackButtonDisplayMode: isIOS26 ? "minimal" : "default",
              }}
            />
          </ErrorBoundary>
        </AbsolutePathProvider>
      );
  }
}

const getInitialRouteName = (segment: Segment) => {
  switch (segment) {
    case "(feeds)":
      return "feeds/index";
    case "(search)":
      return "search/index";
    case "(notifications)":
      return "notifications";
    case "(self)":
      return "self";
    case "(groups)":
      return "groups";
  }
};

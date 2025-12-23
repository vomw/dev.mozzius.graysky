import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { Trans } from "@lingui/macro";
import { ErrorBoundary } from "react-error-boundary";

import { ErrorBoundary as ErrorBoundaryView } from "~/components/error-boundary";
import { Text } from "~/components/themed/text";
import { AbsolutePathProvider } from "~/lib/absolute-path-context";
import { useOptionalAgent } from "~/lib/agent";
import { isIOS26 } from "~/lib/utils/version";

export default function SubStack({
  segment,
}: {
  segment: "(feeds)" | "(search)" | "(notifications)" | "(self)";
}) {
  // agent might not be available yet
  const agent = useOptionalAgent();

  // Wait for agent to be ready
  if (!agent?.did) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-base">
          <Trans>Connecting...</Trans>
        </Text>
      </View>
    );
  }

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

const getInitialRouteName = (
  segment: "(feeds)" | "(search)" | "(notifications)" | "(self)",
) => {
  switch (segment) {
    case "(feeds)":
      return "feeds/index";
    case "(search)":
      return "search/index";
    case "(notifications)":
      return "notifications";
    case "(self)":
      return "self";
  }
};

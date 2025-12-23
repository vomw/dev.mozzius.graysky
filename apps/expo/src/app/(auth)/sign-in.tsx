import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { showToastable } from "react-native-toastable";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { AtSignIcon, InfoIcon } from "lucide-react-native";

import { TextButton } from "~/components/text-button";
import { Text } from "~/components/themed/text";
import { TextInput } from "~/components/themed/text-input";
import { TransparentHeaderUntilScrolled } from "~/components/transparent-header";
import { useLinkPress } from "~/lib/hooks/link-press";
import { useSession } from "~/lib/session-provider";

export default function SignIn() {
  const router = useRouter();
  const theme = useTheme();
  const { handle: initialHandle } = useLocalSearchParams<{ handle?: string }>();
  const { openLink, showLinkOptions } = useLinkPress();
  const { _ } = useLingui();
  const { signIn } = useSession();

  const [handle, setHandle] = useState(initialHandle ?? "");

  const login = useMutation({
    mutationKey: ["login"],
    mutationFn: async () => {
      const cleanHandle = handle.startsWith("@")
        ? handle.slice(1).trim()
        : handle.trim();
      await signIn(cleanHandle);
    },
    onSuccess: () => router.replace("/(feeds)/feeds"),
    onError: (err) =>
      showToastable({
        title: _(msg`Could not log you in`),
        message: err instanceof Error ? err.message : _(msg`Unknown error`),
        status: "warning",
      }),
  });

  // Auto-append .bsky.social if needed when blurring
  const handleBlur = () => {
    let fixed = handle;
    if (handle.startsWith("@")) fixed = handle.slice(1);
    if (!handle.includes(".") && handle.length > 0)
      fixed = `${fixed}.bsky.social`;
    setHandle(fixed);
  };

  return (
    <TransparentHeaderUntilScrolled>
      <KeyboardAwareScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 p-4"
      >
        <Stack.Screen options={{ headerRight: () => null }} />
        <View className="items-stretch gap-4">
          <View
            className="flex-row items-center rounded-lg pl-3"
            style={{ backgroundColor: theme.colors.card }}
          >
            <AtSignIcon size={18} color="rgb(163 163 163)" />
            <TextInput
              className="flex-1 flex-row items-center px-2 py-3 text-base leading-5"
              placeholder={_(msg`Handle (e.g. alice.bsky.social)`)}
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={handleBlur}
              autoFocus
            />
          </View>
          <Animated.View
            entering={FadeIn}
            className="flex-row rounded border-blue-500 bg-blue-50 p-3 pb-4 dark:bg-blue-950"
            style={{ borderWidth: 0.5 }}
          >
            <InfoIcon size={18} className="mt-px" color={theme.colors.text} />
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium leading-5">
                <Trans>Sign in with OAuth</Trans>
              </Text>
              <Text className="mt-1">
                <Trans>
                  You{"'"}ll be redirected to your Bluesky provider to securely
                  sign in. No password is stored in the app.
                </Trans>
              </Text>
              <Text
                className="mt-2"
                primary
                accessibilityRole="link"
                onPress={() => openLink("https://bsky.social")}
                onLongPress={() => showLinkOptions("https://bsky.social")}
              >
                <Trans>Don{"'"}t have an account? Sign up at bsky.social</Trans>
              </Text>
            </View>
          </Animated.View>
          <View className="flex-row items-center justify-end pt-1">
            {!login.isPending ? (
              <TextButton
                disabled={!handle}
                onPress={() => login.mutate()}
                title={_(msg`Continue`)}
                className="font-medium"
              />
            ) : (
              <ActivityIndicator className="px-2" />
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </TransparentHeaderUntilScrolled>
  );
}

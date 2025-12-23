import { Fragment } from "react";
import {
  ActivityIndicator,
  Alert,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import { useMMKVObject } from "react-native-mmkv";
import { showToastable } from "react-native-toastable";
import { Link, useRouter } from "expo-router";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, PlusIcon } from "lucide-react-native";

import { ItemSeparator } from "~/components/item-separator";
import { Text } from "~/components/themed/text";
import { useLogOut } from "~/lib/log-out-context";
import { useSession, type SavedSession } from "~/lib/session-provider";
import { store } from "~/lib/storage/storage";
import { cx } from "~/lib/utils/cx";
import { Avatar } from "./avatar";

// Re-export SavedSession for backwards compatibility
export type { SavedSession } from "~/lib/session-provider";

interface Props {
  active?: string;
  onSuccessfulSwitch?: () => void;
  chevrons?: boolean;
  showAddAccount?: boolean;
}

export function SwitchAccounts({
  active,
  onSuccessfulSwitch,
  chevrons,
  showAddAccount,
}: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const logOut = useLogOut();
  const router = useRouter();
  const { _ } = useLingui();
  const { switchAccount, signIn } = useSession();

  const [sessions = []] = useMMKVObject<SavedSession[]>("sessions", store);

  const switchMutation = useMutation({
    mutationKey: ["switch-accounts"],
    mutationFn: async (did: string) => {
      await switchAccount(did);
      return did;
    },
    onError: (err, did) => {
      Alert.alert(
        _(msg`Could not switch account`),
        err instanceof Error ? err.message : _(msg`Unknown error`),
      );
      console.error(err);
      // Find the handle for this DID to pre-fill the sign-in form
      const account = sessions.find((s) => s.did === did);
      if (account) {
        router.push(`/sign-in?handle=${account.handle}`);
      }
    },
    onSuccess: (did) => {
      const account = sessions.find((s) => s.did === did);
      showToastable({
        title: _(msg`Logged in`),
        message: _(msg`You are now logged in as @${account?.handle ?? did}`),
        status: "success",
      });
      void queryClient.resetQueries();
      router.replace("/(feeds)/feeds");
      onSuccessfulSwitch?.();
    },
  });

  const handleAccountPress = async (account: SavedSession) => {
    if (account.signedOut) {
      // If signed out, need to re-authenticate
      router.push(`/sign-in?handle=${account.handle}`);
    } else {
      // Try to switch to this account
      switchMutation.mutate(account.did);
    }
  };

  return (
    <View
      style={{ backgroundColor: theme.colors.card }}
      className="flex-1 overflow-hidden rounded-2xl"
    >
      {sessions
        .sort((a) => {
          // move active account to top
          if (a.did === active) return -1;
          return 0;
        })
        .map((account) => (
          <Fragment key={account.did}>
            <TouchableHighlight
              className={cx("flex-1", switchMutation.isPending && "opacity-50")}
              onPress={() => handleAccountPress(account)}
              disabled={switchMutation.isPending || account.did === active}
            >
              <View
                className="flex-1 flex-row items-center px-4 py-2"
                style={{ backgroundColor: theme.colors.card }}
              >
                <Avatar
                  uri={account.avatar}
                  alt={account.displayName ?? `@${account.handle}`}
                  className="shrink-0"
                  size="medium"
                />
                <View className="ml-3 flex-1">
                  {account.displayName && (
                    <Text className="text-base font-medium">
                      {account.displayName}
                    </Text>
                  )}
                  <Text className="text-neutral-500">@{account.handle}</Text>
                  {account.signedOut && (
                    <Text className="text-xs text-orange-500">
                      <Trans>Tap to sign in again</Trans>
                    </Text>
                  )}
                </View>
                {switchMutation.isPending &&
                switchMutation.variables === account.did ? (
                  <ActivityIndicator />
                ) : account.did === active ? (
                  <TouchableOpacity
                    onPress={() => {
                      router.push("../");
                      void logOut();
                    }}
                  >
                    <Text primary className="font-medium">
                      <Trans>Sign out</Trans>
                    </Text>
                  </TouchableOpacity>
                ) : (
                  chevrons && (
                    <ChevronRightIcon size={16} className="text-neutral-500" />
                  )
                )}
              </View>
            </TouchableHighlight>
            <ItemSeparator iconWidth="w-10" />
          </Fragment>
        ))}
      {showAddAccount && (
        <Link href="/sign-in" asChild>
          <TouchableHighlight
            className={cx("flex-1", switchMutation.isPending && "opacity-50")}
            disabled={switchMutation.isPending}
          >
            <View
              className="flex-1 flex-row items-center px-4 py-2"
              style={{ backgroundColor: theme.colors.card }}
            >
              <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                <PlusIcon
                  size={24}
                  className="text-neutral-500 dark:text-neutral-300"
                />
              </View>
              <View className="ml-3 flex-1">
                <Text>
                  <Trans>Add another account</Trans>
                </Text>
              </View>
            </View>
          </TouchableHighlight>
        </Link>
      )}
    </View>
  );
}

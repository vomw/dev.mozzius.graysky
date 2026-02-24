import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { showToastable } from "react-native-toastable";
import { Trans } from "@lingui/macro";
import { useTheme } from "@react-navigation/native";
import { CheckCircle2Icon, UsersIcon } from "lucide-react-native";

import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import { sendMessage, subscribeToGroups, type Group } from "~/lib/groups";

interface Props {
  postUri: string; // at:// URI of the post to share
  onDismiss: () => void;
}

/**
 * A sheet that lists the user's groups and allows them to share
 * a Bluesky post URI into a selected group chat.
 */
export function SendToGroupSheet({ postUri, onDismiss }: Props) {
  const theme = useTheme();
  const agent = useOptionalAgent();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const currentDid = agent?.session?.did;

  useEffect(() => {
    if (!currentDid) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToGroups(currentDid, (g) => {
      setGroups(g);
      setLoading(false);
    });
    return unsubscribe;
  }, [currentDid]);

  const handleSend = useCallback(
    async (groupId: string) => {
      if (!currentDid || sending) return;
      setSending(groupId);
      try {
        await sendMessage(groupId, currentDid, postUri);
        setSent(groupId);
        showToastable({
          title: "Shared!",
          message: "Post shared to group chat.",
        });
        setTimeout(onDismiss, 800);
      } catch (e) {
        console.error("Failed to share post:", e);
        showToastable({
          title: "Error",
          message: "Could not share post. Please try again.",
        });
      } finally {
        setSending(null);
      }
    },
    [currentDid, postUri, sending, onDismiss],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Group>) => {
      const isSending = sending === item.id;
      const isSent = sent === item.id;

      return (
        <TouchableOpacity
          onPress={() => handleSend(item.id)}
          disabled={!!sending || !!sent}
          className="flex-row items-center px-4 py-3 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: theme.colors.primary + "22" }}
          >
            <UsersIcon size={18} color={theme.colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold">{item.name}</Text>
            <Text
              className="text-xs"
              style={{ color: theme.colors.text + "88" }}
            >
              {item.members.length} <Trans>members</Trans>
            </Text>
          </View>
          {isSending && <ActivityIndicator size="small" color={theme.colors.primary} />}
          {isSent && <CheckCircle2Icon size={20} color={theme.colors.primary} />}
        </TouchableOpacity>
      );
    },
    [sending, sent, theme, handleSend],
  );

  if (!currentDid) {
    return (
      <View className="p-6 items-center">
        <Text className="text-center text-sm" style={{ color: theme.colors.text + "99" }}>
          <Trans>Sign in to share to a group.</Trans>
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="p-8 items-center">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View className="p-6 items-center">
        <UsersIcon size={32} color={theme.colors.text + "44"} />
        <Text
          className="text-center text-sm mt-3"
          style={{ color: theme.colors.text + "99" }}
        >
          <Trans>
            You are not in any groups yet. Join or create a group first.
          </Trans>
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      scrollEnabled={groups.length > 5}
      style={{ maxHeight: 300 }}
    />
  );
}

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { showToastable } from "react-native-toastable";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Trans } from "@lingui/macro";
import { useTheme } from "@react-navigation/native";
import { CheckCircle2Icon, UsersIcon } from "lucide-react-native";

import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import { sendMessage, subscribeToGroups, type Group } from "~/lib/groups";

export default function SendToGroupModal() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const agent = useOptionalAgent();
  const router = useRouter();
  const theme = useTheme();
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

  const handleSend = async (groupId: string) => {
    if (!currentDid || !uri || sending) return;
    setSending(groupId);
    try {
      await sendMessage(groupId, currentDid, uri);
      setSent(groupId);
      showToastable({
        title: "Shared!",
        message: "Post shared to group chat.",
      });
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 800);
    } catch (e) {
      console.error("Failed to share post:", e);
      showToastable({
        title: "Error",
        message: "Could not share post. Please try again.",
      });
      setSending(null);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Group>) => {
    const isSending = sending === item.id;
    const isSent = sent === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleSend(item.id)}
        disabled={!!sending || !!sent}
        className="flex-row items-center px-4 py-4 border-b"
        style={{ borderColor: theme.colors.border }}
      >
        <View
          className="w-11 h-11 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: theme.colors.primary + "22" }}
        >
          <UsersIcon size={20} color={theme.colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold">{item.name}</Text>
          <Text
            className="text-xs mt-0.5"
            style={{ color: theme.colors.text + "88" }}
          >
            {item.members.length} <Trans>members</Trans>
          </Text>
        </View>
        {isSending && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
        {isSent && (
          <CheckCircle2Icon size={22} color={theme.colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const body = () => {
    if (!currentDid) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Text
            className="text-center text-sm"
            style={{ color: theme.colors.text + "99" }}
          >
            <Trans>Sign in to share to a group.</Trans>
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }

    if (groups.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <UsersIcon size={48} color={theme.colors.text + "44"} />
          <Text className="text-center text-lg font-semibold mt-4">
            <Trans>No Groups</Trans>
          </Text>
          <Text
            className="text-center text-sm mt-2"
            style={{ color: theme.colors.text + "99" }}
          >
            <Trans>
              You are not in any group chats yet. Visit the Groups tab to get
              started.
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
        style={{ backgroundColor: theme.colors.background }}
      />
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Send to Group",
          presentation: "modal",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View
        className="flex-1"
        style={{ backgroundColor: theme.colors.background }}
      >
        {body()}
      </View>
    </>
  );
}

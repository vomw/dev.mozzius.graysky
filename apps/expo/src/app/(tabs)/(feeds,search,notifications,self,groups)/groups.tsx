import { useEffect, useState } from "react";
import {
  FlatList,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { UsersIcon } from "lucide-react-native";
import { useTheme } from "@react-navigation/native";
import { Trans } from "@lingui/macro";

import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import { subscribeToGroups, type Group } from "~/lib/groups";

export default function GroupsScreen() {
  const agent = useOptionalAgent();
  const router = useRouter();
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const currentDid = agent?.session?.did;

  useEffect(() => {
    if (!currentDid) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToGroups(currentDid, (updatedGroups) => {
      setGroups(updatedGroups);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentDid]);

  const renderItem = ({ item }: ListRenderItemInfo<Group>) => (
    <TouchableOpacity
      onPress={() => router.push(`/groups/${item.id}`)}
      className="flex-row items-center px-4 py-3 border-b"
      style={{ borderColor: theme.colors.border }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: theme.colors.primary + "22" }}
      >
        <UsersIcon size={22} color={theme.colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold">{item.name}</Text>
        {item.lastMessage ? (
          <Text
            className="text-sm mt-0.5"
            style={{ color: theme.colors.text + "99" }}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        ) : (
          <Text className="text-sm mt-0.5" style={{ color: theme.colors.text + "66" }}>
            <Trans>No messages yet</Trans>
          </Text>
        )}
      </View>
      <Text className="text-xs" style={{ color: theme.colors.text + "66" }}>
        {item.members.length} <Trans>members</Trans>
      </Text>
    </TouchableOpacity>
  );

  if (!currentDid) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <UsersIcon size={48} color={theme.colors.text + "44"} />
        <Text className="text-center text-base mt-4 font-medium">
          <Trans>Sign in to access Groups</Trans>
        </Text>
        <Text className="text-center text-sm mt-2" style={{ color: theme.colors.text + "99" }}>
          <Trans>Group chats are available once you are logged into your Bluesky account.</Trans>
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-base" style={{ color: theme.colors.text + "99" }}>
          <Trans>Loading groups...</Trans>
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
      contentContainerStyle={groups.length === 0 ? { flex: 1 } : undefined}
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center p-8">
          <UsersIcon size={48} color={theme.colors.text + "44"} />
          <Text className="text-center text-lg font-semibold mt-4">
            <Trans>No Group Chats Yet</Trans>
          </Text>
          <Text
            className="text-center text-sm mt-2"
            style={{ color: theme.colors.text + "99" }}
          >
            <Trans>
              Share a Bluesky post to a group to get started. Groups are private
              chats outside the AT Protocol.
            </Trans>
          </Text>
        </View>
      }
    />
  );
}

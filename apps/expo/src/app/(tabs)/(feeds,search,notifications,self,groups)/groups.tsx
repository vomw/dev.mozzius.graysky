import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { PlusIcon, UsersIcon } from "lucide-react-native";
import { useTheme } from "@react-navigation/native";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";

import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import { createGroup, subscribeToGroups, type Group } from "~/lib/groups";

export default function GroupsScreen() {
  const agent = useOptionalAgent();
  const router = useRouter();
  const theme = useTheme();
  const { _ } = useLingui();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const currentDid = agent?.session?.did;

  useEffect(() => {
    if (!currentDid) {
      setLoading(false);
      return;
    }

    console.log("[Groups] Current DID:", currentDid);

    const unsubscribe = subscribeToGroups(currentDid, (updatedGroups) => {
      setGroups(updatedGroups);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentDid]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentDid || creating) return;
    setCreating(true);
    try {
      const groupId = await createGroup(newGroupName.trim(), currentDid);
      setShowCreate(false);
      setNewGroupName("");
      router.push(`/groups/${groupId}`);
    } catch (e) {
      console.error("[Groups] Failed to create group:", e);
      Alert.alert("Error", "Failed to create group. Check console for details.");
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Group>) => (
    <TouchableOpacity
      onPress={() => router.push(`/groups/${item.id}`)}
      className="flex-row items-center px-4 py-3 border-b"
      style={{ borderColor: theme.colors.border }}
    >
      {item.avatarUrl ? (
        <Image
          source={{ uri: item.avatarUrl }}
          className="w-12 h-12 rounded-full mr-3"
          contentFit="cover"
        />
      ) : (
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: theme.colors.primary + "22" }}
        >
          <UsersIcon size={22} color={theme.colors.primary} />
        </View>
      )}
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
    <>
      <Stack.Screen
        options={{
          title: _(msg`Groups`),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="mr-3"
            >
              <PlusIcon size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="w-80 rounded-2xl p-5"
            style={{ backgroundColor: theme.colors.card }}
          >
            <Text className="text-lg font-semibold mb-4">
              <Trans>Create Group</Trans>
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-sm mb-4"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
              placeholder={_(msg`Group name`)}
              placeholderTextColor={theme.colors.text + "66"}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setShowCreate(false);
                  setNewGroupName("");
                }}
                className="px-4 py-2 mr-2"
              >
                <Text style={{ color: theme.colors.text + "99" }}>
                  <Trans>Cancel</Trans>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || creating}
                className="px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: newGroupName.trim()
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <Text style={{ color: "#fff" }}>
                  <Trans>{creating ? "Creating..." : "Create"}</Trans>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                Tap the + button above to create a group.
              </Trans>
            </Text>
          </View>
        }
      />
    </>
  );
}

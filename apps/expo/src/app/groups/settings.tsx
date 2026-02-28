import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  openPicker,
  type Image as CroppedImage,
} from "react-native-image-crop-picker";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type AppBskyActorDefs } from "@atproto/api";
import { type I18n } from "@lingui/core";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ImagePlusIcon,
  PlusIcon,
  SearchIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react-native";

import { Avatar } from "~/components/avatar";
import { Text } from "~/components/themed/text";
import { useAgent } from "~/lib/agent";
import { compress, getGalleryPermission } from "~/lib/composer/utils";
import {
  addGroupMember,
  fetchGroup,
  updateGroupAvatar,
  updateGroupName,
  uploadGroupAvatar,
  type Group,
} from "~/lib/groups";

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const agent = useAgent();
  const { _, i18n } = useLingui();

  const [group, setGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Load group data
  useEffect(() => {
    if (!groupId) return;
    void fetchGroup(groupId).then((g) => {
      if (g) {
        setGroup(g);
        setEditName(g.name);
      }
    });
  }, [groupId]);

  // Resolve member profiles
  const membersQuery = useQuery({
    queryKey: ["group-members", group?.members],
    queryFn: async () => {
      if (!group?.members.length) return [];
      const res = await agent.getProfiles({ actors: group.members });
      if (!res.success) return [];
      return res.data.profiles;
    },
    enabled: !!group?.members.length && agent.hasSession,
  });

  // Search for users to invite
  const searchQuery = useQuery({
    queryKey: ["group-invite-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const res = await agent.searchActors({ term: searchTerm.trim() });
      if (!res.success) return [];
      return res.data.actors;
    },
    enabled: searchTerm.trim().length > 0 && agent.hasSession,
  });

  // Filter out existing members from search results
  const filteredResults = useMemo(() => {
    if (!searchQuery.data || !group) return [];
    const memberSet = new Set(group.members);
    return searchQuery.data.filter((actor) => !memberSet.has(actor.did));
  }, [searchQuery.data, group]);

  // Save group name
  const saveNameMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !editName.trim()) return;
      await updateGroupName(groupId, editName.trim());
    },
    onSuccess: () => {
      setGroup((g) => (g ? { ...g, name: editName.trim() } : g));
      Alert.alert(_(msg`Saved`), _(msg`Group name updated.`));
    },
    onError: () => Alert.alert(_(msg`Error`), _(msg`Failed to update name.`)),
  });

  // Upload avatar
  const avatarMutation = useMutation({
    mutationFn: async (image: CroppedImage) => {
      if (!groupId) throw new Error("No group");
      const compressed = await compress({
        uri: image.path,
        needsResize: false,
      });
      const url = await uploadGroupAvatar(groupId, compressed);
      await updateGroupAvatar(groupId, url);
      return url;
    },
    onSuccess: (url) => {
      setGroup((g) => (g ? { ...g, avatarUrl: url } : g));
    },
    onError: () =>
      Alert.alert(_(msg`Error`), _(msg`Failed to upload avatar.`)),
  });

  const pickAvatar = useCallback(async () => {
    if (!(await getGalleryPermission(i18n))) return;
    const image = await openPicker({
      height: 1000,
      width: 1000,
      cropping: true,
      cropperCircleOverlay: true,
      forceJpg: true,
    }).catch(() => null);
    if (!image) return;
    avatarMutation.mutate(image);
  }, [i18n, avatarMutation]);

  // Invite member
  const inviteMutation = useMutation({
    mutationFn: async ({
      did,
      displayName,
    }: {
      did: string;
      displayName?: string;
    }) => {
      if (!groupId) throw new Error("No group");
      await addGroupMember(groupId, did, displayName);
      return did;
    },
    onSuccess: (did) => {
      setGroup((g) =>
        g ? { ...g, members: [...g.members, did] } : g,
      );
      setSearchTerm("");
    },
    onError: () =>
      Alert.alert(_(msg`Error`), _(msg`Failed to invite member.`)),
  });

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: _(msg`Group Settings`),
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <FlatList
        data={[]}
        renderItem={() => null}
        style={{ backgroundColor: theme.colors.background }}
        ListHeaderComponent={
          <View className="flex-1">
            {/* Avatar section */}
            <View className="items-center py-6">
              <TouchableOpacity onPress={pickAvatar}>
                <View className="relative">
                  {group.avatarUrl ? (
                    <Image
                      source={{ uri: group.avatarUrl }}
                      className="h-24 w-24 rounded-full"
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      className="h-24 w-24 rounded-full items-center justify-center"
                      style={{ backgroundColor: theme.colors.primary + "22" }}
                    >
                      <UsersIcon size={40} color={theme.colors.primary} />
                    </View>
                  )}
                  {avatarMutation.isPending ? (
                    <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <View className="absolute inset-0 items-center justify-center rounded-full bg-black/30">
                      <ImagePlusIcon color="#fff" size={24} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <Text
                className="text-xs mt-2"
                style={{ color: theme.colors.text + "66" }}
              >
                <Trans>Tap to change avatar</Trans>
              </Text>
            </View>

            {/* Group name section */}
            <View className="px-4 mb-6">
              <Text
                className="text-xs uppercase mb-1 ml-1"
                style={{ color: theme.colors.text + "66" }}
              >
                <Trans>Group Name</Trans>
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: theme.colors.card,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={_(msg`Group name`)}
                  placeholderTextColor={theme.colors.text + "66"}
                />
                <TouchableOpacity
                  onPress={() => saveNameMutation.mutate()}
                  disabled={
                    !editName.trim() ||
                    editName.trim() === group.name ||
                    saveNameMutation.isPending
                  }
                  className="ml-2 px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor:
                      editName.trim() && editName.trim() !== group.name
                        ? theme.colors.primary
                        : theme.colors.border,
                  }}
                >
                  <Text style={{ color: "#fff" }} className="text-sm font-medium">
                    <Trans>Save</Trans>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Members section */}
            <View className="px-4 mb-4">
              <Text
                className="text-xs uppercase mb-2 ml-1"
                style={{ color: theme.colors.text + "66" }}
              >
                <Trans>Members</Trans> ({group.members.length})
              </Text>
              {membersQuery.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  className="my-4"
                />
              ) : (
                membersQuery.data?.map((profile) => (
                  <View
                    key={profile.did}
                    className="flex-row items-center py-2 px-2 rounded-lg mb-1"
                    style={{ backgroundColor: theme.colors.card }}
                  >
                    <Avatar
                      size="smallMedium"
                      uri={profile.avatar}
                      alt={profile.displayName}
                    />
                    <View className="flex-1 ml-3">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {profile.displayName ?? profile.handle}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: theme.colors.text + "88" }}
                        numberOfLines={1}
                      >
                        @{profile.handle}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Invite section */}
            <View className="px-4 mb-6">
              <Text
                className="text-xs uppercase mb-2 ml-1"
                style={{ color: theme.colors.text + "66" }}
              >
                <Trans>Invite Members</Trans>
              </Text>
              <View
                className="flex-row items-center rounded-xl px-3"
                style={{
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <SearchIcon size={16} color={theme.colors.text + "66"} />
                <TextInput
                  className="flex-1 py-3 px-2 text-sm"
                  style={{ color: theme.colors.text }}
                  placeholder={_(msg`Search by handle or name...`)}
                  placeholderTextColor={theme.colors.text + "66"}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {searchQuery.isPending && searchTerm.trim() && (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  className="my-3"
                />
              )}
              {filteredResults.map((actor) => (
                <View
                  key={actor.did}
                  className="flex-row items-center py-2 px-2 rounded-lg mt-1"
                  style={{ backgroundColor: theme.colors.card }}
                >
                  <Avatar
                    size="smallMedium"
                    uri={actor.avatar}
                    alt={actor.displayName}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-medium" numberOfLines={1}>
                      {actor.displayName ?? actor.handle}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.text + "88" }}
                      numberOfLines={1}
                    >
                      @{actor.handle}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => inviteMutation.mutate({ did: actor.did, displayName: actor.displayName ?? actor.handle })}
                    disabled={inviteMutation.isPending}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    <PlusIcon size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {searchTerm.trim() &&
                !searchQuery.isPending &&
                filteredResults.length === 0 && (
                  <Text
                    className="text-xs text-center mt-3"
                    style={{ color: theme.colors.text + "66" }}
                  >
                    <Trans>No users found</Trans>
                  </Text>
                )}
            </View>
          </View>
        }
      />
    </>
  );
}

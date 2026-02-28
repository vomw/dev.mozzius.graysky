import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { SendHorizontalIcon, SettingsIcon, UsersIcon } from "lucide-react-native";

import { BskyPostEmbed } from "~/components/groups/bsky-post-embed";
import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import {
  fetchGroup,
  isBskyPostContent,
  sendMessage,
  subscribeToMessages,
  type Group,
  type Message,
} from "~/lib/groups";
import { timeSince } from "~/lib/utils/time";

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const agent = useOptionalAgent();
  const theme = useTheme();
  const router = useRouter();
  const { i18n } = useLingui();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const currentDid = agent?.session?.did;

  // Fetch group metadata for header
  useEffect(() => {
    if (!groupId) return;
    void fetchGroup(groupId).then(setGroup);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const unsubscribe = subscribeToMessages(groupId, setMessages);
    return unsubscribe;
  }, [groupId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !currentDid || !groupId || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      await sendMessage(groupId, currentDid, text);
    } catch (e) {
      console.error("Failed to send message:", e);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, currentDid, groupId, sending]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Message>) => {
      // System messages (e.g. "X was added to the group")
      if (item.type === "system") {
        return (
          <View className="px-6 py-2">
            <Text
              className="text-xs text-center italic"
              style={{ color: theme.colors.text + "77" }}
            >
              {item.text}
            </Text>
          </View>
        );
      }

      const isOwn = item.sender === currentDid;
      const isPostEmbed = isBskyPostContent(item.text);

      return (
        <View className={`px-3 py-1 ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <Text
              className="text-xs mb-1 ml-1"
              style={{ color: theme.colors.text + "77" }}
              numberOfLines={1}
            >
              {item.sender.slice(0, 20)}...
            </Text>
          )}
          <View
            className="max-w-[85%] rounded-2xl px-3 py-2"
            style={{
              backgroundColor: isOwn
                ? theme.colors.primary
                : theme.colors.card,
              borderWidth: isOwn ? 0 : 1,
              borderColor: theme.colors.border,
            }}
          >
            {isPostEmbed ? (
              <BskyPostEmbed content={item.text} />
            ) : (
              <Text
                className="text-sm"
                style={{ color: isOwn ? "#fff" : theme.colors.text }}
              >
                {item.text}
              </Text>
            )}
          </View>
          {item.createdAt && (
            <Text
              className="text-xs mt-1 mx-1"
              style={{ color: theme.colors.text + "55" }}
            >
              {timeSince(item.createdAt.toDate(), i18n).visible}
            </Text>
          )}
        </View>
      );
    },
    [currentDid, theme, i18n],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerTitle: () => (
            <TouchableOpacity
              onPress={() =>
                router.push(`/groups/settings?groupId=${groupId}`)
              }
              className="flex-row items-center"
            >
              {group?.avatarUrl ? (
                <Image
                  source={{ uri: group.avatarUrl }}
                  className="h-7 w-7 rounded-full"
                  contentFit="cover"
                />
              ) : (
                <View
                  className="h-7 w-7 rounded-full items-center justify-center"
                  style={{ backgroundColor: theme.colors.primary + "22" }}
                >
                  <UsersIcon size={14} color={theme.colors.primary} />
                </View>
              )}
              <Text className="text-base font-semibold ml-2" numberOfLines={1}>
                {group?.name ?? "Group Chat"}
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                router.push(`/groups/settings?groupId=${groupId}`)
              }
              className="mr-2"
            >
              <SettingsIcon size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
        style={{ backgroundColor: theme.colors.background }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
          style={{ backgroundColor: theme.colors.background }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-12">
              <Text
                className="text-center text-sm"
                style={{ color: theme.colors.text + "66" }}
              >
                <Trans>No messages yet. Say something!</Trans>
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View
          className="flex-row items-end px-3 py-2 border-t"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          }}
        >
          <TextInput
            className="flex-1 rounded-2xl px-4 py-2 text-sm mr-2"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderWidth: 1,
              borderColor: theme.colors.border,
              maxHeight: 120,
            }}
            placeholder="Message..."
            placeholderTextColor={theme.colors.text + "66"}
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor:
                inputText.trim() && !sending
                  ? theme.colors.primary
                  : theme.colors.border,
            }}
          >
            <SendHorizontalIcon size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

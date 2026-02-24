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
import { Stack, useLocalSearchParams } from "expo-router";
import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { SendHorizontalIcon } from "lucide-react-native";

import { BskyPostEmbed } from "~/components/groups/bsky-post-embed";
import { Text } from "~/components/themed/text";
import { useOptionalAgent } from "~/lib/agent";
import {
  isBskyPostContent,
  sendMessage,
  subscribeToMessages,
  type Message,
} from "~/lib/groups";
import { timeSince } from "~/lib/utils/time";

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const agent = useOptionalAgent();
  const theme = useTheme();
  const { i18n } = useLingui();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const currentDid = agent?.session?.did;

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
      const isOwn = item.senderDid === currentDid;
      const isPostEmbed = isBskyPostContent(item.content);

      return (
        <View className={`px-3 py-1 ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <Text
              className="text-xs mb-1 ml-1"
              style={{ color: theme.colors.text + "77" }}
              numberOfLines={1}
            >
              {item.senderDid.slice(0, 20)}...
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
              <BskyPostEmbed content={item.content} />
            ) : (
              <Text
                className="text-sm"
                style={{ color: isOwn ? "#fff" : theme.colors.text }}
              >
                {item.content}
              </Text>
            )}
          </View>
          {item.timestamp && (
            <Text
              className="text-xs mt-1 mx-1"
              style={{ color: theme.colors.text + "55" }}
            >
              {timeSince(item.timestamp.toDate(), i18n).visible}
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
          title: "Group Chat",
          headerBackButtonDisplayMode: "minimal",
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

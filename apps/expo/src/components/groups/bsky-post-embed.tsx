import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { AppBskyFeedDefs, AppBskyFeedPost } from "@atproto/api";
import { useLingui } from "@lingui/react";
import { useTheme } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react-native";

import { Avatar } from "~/components/avatar";
import { RichText } from "~/components/rich-text";
import { Text } from "~/components/themed/text";
import { useAbsolutePath } from "~/lib/absolute-path-context";
import { useAgent } from "~/lib/agent";
import { resolveToAtUri } from "~/lib/groups";
import { timeSince } from "~/lib/utils/time";

interface Props {
  content: string; // at:// URI or bsky.app URL
}

/**
 * Renders a Bluesky post inline inside a group chat bubble.
 * Reuses the existing agent to fetch post data via the AT Protocol.
 */
export function BskyPostEmbed({ content }: Props) {
  const theme = useTheme();
  const agent = useAgent();
  const router = useRouter();
  const path = useAbsolutePath();
  const { i18n } = useLingui();

  const atUri = resolveToAtUri(content);

  const { data, isPending, isError } = useQuery({
    queryKey: ["group-post-embed", atUri],
    queryFn: async () => {
      if (!atUri) throw new Error("Invalid URI");
      const thread = await agent.getPostThread({ uri: atUri, depth: 0 });
      if (!thread.success) throw new Error("Failed to fetch post");
      const post = thread.data.thread;
      if (!AppBskyFeedDefs.isThreadViewPost(post)) {
        throw new Error("Post not found");
      }
      return post.post;
    },
    enabled: !!atUri && agent.hasSession,
  });

  if (!atUri) {
    return (
      <View
        className="rounded-xl p-3 mt-1"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderWidth: 1,
        }}
      >
        <Text className="text-xs" style={{ color: theme.colors.text + "99" }}>
          Invalid post link
        </Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View
        className="rounded-xl p-4 mt-1 items-center justify-center"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderWidth: 1,
        }}
      >
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View
        className="rounded-xl p-3 mt-1 flex-row items-center gap-2"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderWidth: 1,
        }}
      >
        <AlertCircleIcon size={16} color={theme.colors.text + "66"} />
        <Text className="text-xs" style={{ color: theme.colors.text + "99" }}>
          Post could not be loaded
        </Text>
      </View>
    );
  }

  const record = data.record;
  const isPost = AppBskyFeedPost.isRecord(record);
  const rkey = data.uri.split("/").pop()!;
  const timeStr = timeSince(new Date(data.indexedAt), i18n).visible;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() =>
        router.push(path(`/profile/${data.author.handle}/post/${rkey}`))
      }
      className="rounded-xl mt-1 overflow-hidden"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderWidth: 1,
      }}
    >
      <View className="p-3">
        {/* Author row */}
        <View className="flex-row items-center gap-2 mb-2">
          <Avatar uri={data.author.avatar} size="small" />
          <View className="flex-1">
            <Text className="text-sm font-semibold" numberOfLines={1}>
              {data.author.displayName ?? data.author.handle}
            </Text>
            <Text
              className="text-xs"
              style={{ color: theme.colors.text + "88" }}
              numberOfLines={1}
            >
              @{data.author.handle}
            </Text>
          </View>
          <Text className="text-xs" style={{ color: theme.colors.text + "66" }}>
            {timeStr}
          </Text>
        </View>

        {/* Post text */}
        {isPost && record.text ? (
          <RichText
            text={record.text}
            facets={record.facets}
            size="sm"
            numberOfLines={4}
          />
        ) : null}

        {/* Stats row */}
        <View className="flex-row gap-3 mt-2">
          <Text className="text-xs" style={{ color: theme.colors.text + "66" }}>
            ♡ {data.likeCount ?? 0}
          </Text>
          <Text className="text-xs" style={{ color: theme.colors.text + "66" }}>
            ↺ {data.repostCount ?? 0}
          </Text>
          <Text className="text-xs" style={{ color: theme.colors.text + "66" }}>
            💬 {data.replyCount ?? 0}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

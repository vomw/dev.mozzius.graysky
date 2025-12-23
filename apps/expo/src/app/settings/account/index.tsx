import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { AtSignIcon, ExternalLinkIcon, UserIcon } from "lucide-react-native";

import { GroupedList } from "~/components/grouped-list";
import { TransparentHeaderUntilScrolled } from "~/components/transparent-header";
import { useAgent, useOptionalAgent } from "~/lib/agent";
import { useLinkPress } from "~/lib/hooks/link-press";

export default function AccountSettings() {
  const agent = useAgent();
  const { _ } = useLingui();
  const { openLink } = useLinkPress();

  // preload for other pages
  useSelf();

  return (
    <TransparentHeaderUntilScrolled>
      <GroupedList
        groups={[
          {
            title: _(msg`Profile Settings`),
            options: [
              {
                title: _(msg`Edit Profile`),
                href: "/edit-bio",
                icon: UserIcon,
              },
              {
                title: _(msg`Change Handle`),
                href: "/settings/account/change-handle",
                icon: AtSignIcon,
              },
            ],
          },
          {
            title: _(msg`Account Management`),
            options: [
              {
                title: _(msg`Manage account on bsky.app`),
                icon: ExternalLinkIcon,
                onPress: () => openLink("https://bsky.app/settings"),
              },
            ],
            footer: _(
              msg`Password changes, email updates, and account deletion are managed through your Bluesky provider.`,
            ),
          },
        ]}
      />
    </TransparentHeaderUntilScrolled>
  );
}

export const useSelf = () => {
  const agent = useOptionalAgent();

  return useQuery({
    queryKey: ["self"],
    queryFn: async () => {
      if (!agent?.did) throw new Error("Not logged in");
      const self = await agent.getProfile({
        actor: agent.did,
      });
      if (!self.success) throw new Error("Could not fetch own profile");
      return self.data;
    },
  });
};

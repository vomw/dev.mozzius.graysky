import React from "react";
import {
  Text,
  TouchableHighlight,
  View,
  type TouchableHighlightProps,
} from "react-native";
import { useRouter } from "expo-router";

import { cx } from "~/lib/utils/cx";

interface ButtonProps extends TouchableHighlightProps {
  variant?: "white" | "black" | "outline";
  className?: string;
}

export const Button = ({
  onPress,
  className,
  variant = "black",
  children,
  ...props
}: ButtonProps) => {
  return (
    <TouchableHighlight onPress={onPress} className="rounded-full" {...props}>
      <View
        className={cx(
          "w-full items-center justify-center rounded-full px-4 py-2.5",
          {
            black: "bg-neutral-950",
            white: "bg-white",
            outline: "border border-black dark:border-white",
          }[variant],
          className,
        )}
        style={[{ borderCurve: "continuous" }]}
      >
        <Text
          className={cx(
            "text-base font-medium",
            {
              black: "text-white",
              white: "text-black",
              outline: "text-black dark:text-white",
            }[variant],
            props.disabled && "opacity-50",
          )}
        >
          {children}
        </Text>
      </View>
    </TouchableHighlight>
  );
};

interface LinkProps extends Omit<ButtonProps, "onPress"> {
  href: string;
}

export const LinkButton = ({ href, ...props }: LinkProps) => {
  const router = useRouter();
  return (
    <Button
      onPress={() => router.push(href)}
      {...props}
      accessibilityRole="link"
    />
  );
};

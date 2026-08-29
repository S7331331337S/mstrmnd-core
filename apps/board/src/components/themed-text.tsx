import { Text, type TextProps } from "react-native";

import { type, type TypeVariant } from "@/theme";

export function ThemedText({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: TypeVariant }) {
  return <Text {...props} style={[type[variant], style]} />;
}

import type { ComponentProps, PropsWithChildren } from "react";
import { Text, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  Surface,
  TextInput,
  Tooltip,
  useTheme,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type ActionTone = "primary" | "secondary" | "quiet" | "danger";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type ActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "mode" | "icon"
> & {
  label: string;
  tone?: ActionTone;
  icon?: IconName;
};

export function ActionButton({
  accessibilityLabel,
  accessibilityState,
  disabled,
  label,
  tone = "quiet",
  icon,
  ...props
}: ActionButtonProps) {
  const theme = useTheme();
  return (
    <Button
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(disabled),
      }}
      mode={
        tone === "primary"
          ? "contained"
          : tone === "secondary"
            ? "contained-tonal"
            : "text"
      }
      textColor={tone === "danger" ? theme.colors.error : undefined}
      icon={
        icon
          ? (iconProps) => <MaterialCommunityIcons {...iconProps} name={icon} />
          : undefined
      }
      style={{ alignSelf: "flex-start", maxWidth: "100%" }}
      contentStyle={{ minHeight: 48 }}
      labelStyle={{ fontSize: 16, flexShrink: 1 }}
      disabled={disabled}
      {...props}
    >
      {label}
    </Button>
  );
}

export function Panel({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  const theme = useTheme();
  return (
    <Surface
      elevation={0}
      style={{
        gap: compact ? 4 : 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceVariant,
      }}
    >
      {children}
    </Surface>
  );
}

export function Separator() {
  return <Divider />;
}

export function FormField({
  label,
  style,
  ...props
}: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      mode="outlined"
      dense
      label={label}
      accessibilityLabel={typeof label === "string" ? label : undefined}
      style={[{ fontSize: 16 }, style]}
      {...props}
    />
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="min-h-12 flex-row items-center gap-2"
    >
      <ActivityIndicator size={20} accessible={false} />
      <Text className="shrink text-base text-muted-light dark:text-muted-dark">
        {label}
      </Text>
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 text-base text-red-700 dark:text-red-300"
      >
        {message}
      </Text>
      {onRetry ? (
        <IconAction icon="reload" label="Retry" onPress={onRetry} />
      ) : null}
    </View>
  );
}

type IconActionProps = Omit<
  ComponentProps<typeof IconButton>,
  "icon" | "mode"
> & {
  icon: IconName;
  label: string;
  tone?: ActionTone;
};

export function IconAction({
  icon,
  label,
  tone = "quiet",
  disabled,
  loading,
  accessibilityState,
  ...props
}: IconActionProps) {
  const theme = useTheme();
  return (
    <Tooltip title={label}>
      <IconButton
        disabled={disabled}
        loading={loading}
        accessibilityState={{
          ...accessibilityState,
          disabled: Boolean(disabled),
          busy: Boolean(loading),
        }}
        accessibilityLabel={label}
        icon={(iconProps) => (
          <MaterialCommunityIcons {...iconProps} name={icon} />
        )}
        mode={
          tone === "primary"
            ? "contained"
            : tone === "secondary"
              ? "contained-tonal"
              : undefined
        }
        containerColor={tone === "primary" ? theme.colors.primary : undefined}
        iconColor={
          tone === "primary"
            ? theme.colors.onPrimary
            : tone === "danger"
              ? theme.colors.error
              : undefined
        }
        size={24}
        style={{ margin: 0, width: 48, height: 48 }}
        {...props}
      />
    </Tooltip>
  );
}

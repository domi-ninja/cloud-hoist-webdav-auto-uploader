import type { ComponentProps, PropsWithChildren } from "react";
import {
  Button,
  Divider,
  IconButton,
  Surface,
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
      labelStyle={{ fontSize: 16 }}
      disabled={disabled}
      {...props}
    >
      {label}
    </Button>
  );
}

export function Panel({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <Surface
      elevation={0}
      style={{
        gap: 16,
        padding: 16,
        borderRadius: 16,
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
  ...props
}: IconActionProps) {
  const theme = useTheme();
  return (
    <Tooltip title={label}>
      <IconButton
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
        iconColor={tone === "danger" ? theme.colors.error : undefined}
        size={24}
        style={{ margin: 0, width: 48, height: 48 }}
        {...props}
      />
    </Tooltip>
  );
}

import type { PropsWithChildren } from "react";
import { Pressable, type PressableProps, Text, View } from "react-native";

type ActionTone = "primary" | "secondary" | "quiet" | "danger";

type ActionButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  tone?: ActionTone;
};

const buttonClasses: Record<ActionTone, string> = {
  primary: "bg-accent p-4 disabled:opacity-50",
  secondary: "bg-ink-light p-4 disabled:opacity-50 dark:bg-ink-dark",
  quiet: "p-4 disabled:opacity-50",
  danger: "p-4 disabled:opacity-50",
};

const labelClasses: Record<ActionTone, string> = {
  primary: "text-base font-semibold text-canvas-light",
  secondary:
    "text-base font-semibold text-canvas-light dark:text-canvas-dark",
  quiet: "text-base text-accent",
  danger: "text-base text-red-700 dark:text-red-300",
};

export function ActionButton({
  accessibilityLabel,
  label,
  tone = "quiet",
  ...props
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      className={buttonClasses[tone]}
      {...props}
    >
      <Text className={labelClasses[tone]}>{label}</Text>
    </Pressable>
  );
}

export function Panel({ children }: PropsWithChildren) {
  return (
    <View className="gap-4 bg-panel-light p-4 dark:bg-panel-dark">{children}</View>
  );
}

export function Separator() {
  return <View className="h-px bg-muted-light opacity-30 dark:bg-muted-dark" />;
}

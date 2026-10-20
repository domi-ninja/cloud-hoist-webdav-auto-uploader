import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/** Cross-fade the old destination into the destination inferred from the local folder. */
export function DestinationPath({ path }: { path: string }) {
  const [paths, setPaths] = useState({ current: path, previous: path });
  const [fade] = useState(() => new Animated.Value(1));
  const reduceMotion = useReducedMotion();
  if (paths.current !== path) {
    setPaths({ current: path, previous: paths.current });
  }
  const oldPath = paths.previous;

  useEffect(() => {
    if (oldPath === path) return;
    fade.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fade, path, oldPath, reduceMotion]);

  return (
    <View accessibilityLiveRegion="polite">
      <Animated.View style={{
        opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}>
        <Text className="text-base text-muted-light dark:text-muted-dark">{path}</Text>
      </Animated.View>
      {oldPath !== path ? (
        <Animated.View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
        >
          <Text className="text-base text-muted-light dark:text-muted-dark">{oldPath}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

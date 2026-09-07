import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";

export function usePageRefreshAnimation(): number {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return undefined;
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && isFocused) {
        refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused, refresh]);

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    const unsubscribe = parent.addListener("state", () => {
      if (isFocused) refresh();
    });

    return unsubscribe;
  }, [navigation, isFocused, refresh]);

  return refreshKey;
}

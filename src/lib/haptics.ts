import * as Haptics from "expo-haptics";

export const hapticLight = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const hapticMedium = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const hapticHeavy = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export const hapticSuccess = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const hapticSelection = (): void => {
  Haptics.selectionAsync();
};

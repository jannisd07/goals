import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  FocusSession: { goalId: string; sessionLengthMinutes: number };
  Analytics: undefined;
  AnalyticsWeek: {
    weekStartISO: string;
    weekEndISO: string;
    weekLabel: string;
    selectedGoalId?: string;
  };
  Settings: undefined;
  SetupStudying: undefined;
  SetupGeofence: undefined;
  Onboarding: undefined;
  Auth: undefined;
  PasswordReset: undefined;
  Friends: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Grove: undefined;
};

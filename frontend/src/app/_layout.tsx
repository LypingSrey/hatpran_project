import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_500Medium,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { Button, Loading, useText } from '@/components/ui';
import { AppearanceProvider, useAppearance } from '@/lib/appearanceContext';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fonts, makeStyles, spacing, type, useColors, useScheme } from '@/lib/theme';

// Opening a screen by URL (or reloading on web) puts the tabs under it, so it still gets a back button.
export const unstable_settings = { initialRouteName: '(tabs)' };

/** Shown when a saved sign-in couldn't be checked on launch, e.g. no signal at the gym. */
function CantConnect({ message }: { message: string }) {
  const { retryRestore, signOut } = useAuth();
  const styles = useStyles();
  const t = useText();
  return (
    <SafeAreaView style={styles.cantConnect}>
      <View style={styles.cantConnectText}>
        <Text style={t.title}>Can’t connect to HatPran</Text>
        <Text style={[t.body, styles.center]}>You’re still signed in. Check your connection and try again.</Text>
        <Text style={[t.caption, styles.center]}>{message}</Text>
      </View>
      <Button title="Try again" onPress={() => void retryRestore()} style={styles.stretch} />
      <Button title="Log out" variant="ghost" onPress={() => void signOut()} />
    </SafeAreaView>
  );
}

function RootNavigator() {
  const { user, isLoading, restoreError } = useAuth();
  const c = useColors();

  if (isLoading) {
    return <Loading />;
  }

  if (restoreError) {
    return <CantConnect message={restoreError} />;
  }

  const isSignedIn = user !== null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: c.accent,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
        headerBackTitleStyle: { fontFamily: fonts.regular },
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Create account' }} />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen name="workout/new" options={{ title: 'New workout', presentation: 'modal' }} />
        <Stack.Screen name="template/[id]" options={{ title: 'Template' }} />
        <Stack.Screen name="template/new" options={{ title: 'New template', presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="exercise/new" options={{ title: 'Custom exercise', presentation: 'modal' }} />
        <Stack.Screen name="workout/edit/[id]" options={{ title: 'Edit workout', presentation: 'modal' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit profile', presentation: 'modal' }} />
        <Stack.Screen name="record/manual" options={{ title: 'Record', presentation: 'modal' }} />
        <Stack.Screen name="records/[group]" options={{ title: 'Records' }} />
      </Stack.Protected>

      <Stack.Screen name="legal/[doc]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <ThemedRoot />
    </AppearanceProvider>
  );
}

function ThemedRoot() {
  const scheme = useScheme();
  const { ready: appearanceReady } = useAppearance();
  const c = useColors();
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
  });

  // Navigation chrome (headers, tab bar, backgrounds) follows the log-page palette in both appearances.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.accent,
        background: c.background,
        card: c.background,
        text: c.text,
        border: c.rule,
        notification: c.danger,
      },
      fonts: {
        regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
        medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
        bold: { fontFamily: fonts.semibold, fontWeight: '600' as const },
        heavy: { fontFamily: fonts.bold, fontWeight: '700' as const },
      },
    };
  }, [scheme, c]);

  // Hold the first frame until the face and the saved appearance are ready (a failed font falls back to the system face).
  if ((!fontsLoaded && !fontError) || !appearanceReady) {
    return <View style={{ flex: 1, backgroundColor: c.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
            {/* Native confirmations use Alert; web ones need this host. */}
            {Platform.OS === 'web' ? <ConfirmDialogHost /> : null}
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const useStyles = makeStyles((c) => ({
  cantConnect: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: c.background,
  },
  cantConnectText: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  caption: { ...type.caption },
}));

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { openRepoSync } from '@/data/sqlite';
import { useAppLifecycle } from '@/lib/lifecycle';
import Onboarding from '@/screens/Onboarding';
import { useStore } from '@/state/store';
import { T } from '@/ui/Text';
import { dark, light } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

// Open the local database before the first render, so screens start with the
// student's real data and links opened at launch land on the right screen.
function bootstrap() {
  if (useStore.getState().status !== 'loading') return;
  try {
    const { repo, data } = openRepoSync();
    useStore.getState().hydrate(repo, data);
  } catch (e) {
    useStore.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}
bootstrap();

export default function RootLayout() {
  const scheme = useColorScheme();
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const onboarded = useStore((s) => s.settings.onboarded);
  const palette = scheme === 'dark' ? dark : light;

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  useAppLifecycle(status === 'ready' && onboarded);

  if (status === 'loading') return null;
  if (status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: palette.bg }}>
        <T variant="headline" align="center">
          ApexPrep couldn’t open its data
        </T>
        <T variant="subhead" color="textMuted" align="center" style={{ marginTop: 8 }}>
          {error}
        </T>
      </View>
    );
  }

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: palette.primary, background: palette.bgGrouped, card: palette.bg, text: palette.text, border: palette.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="drill" options={{ presentation: 'modal' }} />
        <Stack.Screen name="streak" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="climb" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bank" options={{ presentation: 'modal' }} />
        <Stack.Screen name="badges" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scores" options={{ presentation: 'modal' }} />
        <Stack.Screen name="score-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dev-reset" options={{ animation: 'none' }} />
      </Stack>
      {/* First run: onboarding covers the app until it's done. Keeping the navigator
          mounted underneath means there's never a route to get stuck on. */}
      {!onboarded ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <Onboarding />
        </View>
      ) : null}
    </ThemeProvider>
  );
}

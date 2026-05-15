import { Mixpanel } from 'mixpanel-react-native';

const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

let mixpanel: Mixpanel | null = null;

export async function initMixpanel(): Promise<void> {
  if (!token) {
    console.log('[ANALYTICS] Mixpanel token not found, skipping init');
    return;
  }
  if (mixpanel) return;

  mixpanel = new Mixpanel(token, true);
  await mixpanel.init();
  console.log('[ANALYTICS] Mixpanel initialized');
}

export function getMixpanel(): Mixpanel | null {
  return mixpanel;
}

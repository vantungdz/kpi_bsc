// Navigation utility functions and composable

import { useRouter } from 'vue-router';

/**
 * Navigation composable - Returns navigation functions with router already bound
 * Usage: const { goBack, navigateTo } = useNavigation();
 */
export function useNavigation() {
  const router = useRouter();

  return {
    goBack: () => router.go(-1),
    navigateTo: (route) => router.push(route),
    goToHome: () => router.push({ name: 'HomePage' }),
    goToLogin: () => router.push({ name: 'LoginPage' }),
    replaceTo: (route) => router.replace(route),
  };
}

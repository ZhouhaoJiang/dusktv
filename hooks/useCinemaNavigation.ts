import { useRouter } from 'expo-router';
import type { CinemaPage } from '@/components/cinema/CinemaUI';
export function useCinemaNavigation() {
  const router = useRouter();
  return {
    onNavigate: (page: CinemaPage) => { router.push(page === 'home' ? '/' : `/${page}`); },
    onBack: () => { if (router.canGoBack()) router.back(); else router.replace('/'); },
  };
}

import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** Entry route: send signed-in users to their lists and everyone else to sign in. */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/lists' : '/sign-in'} />;
}

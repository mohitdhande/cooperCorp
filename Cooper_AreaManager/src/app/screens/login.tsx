import React from 'react';
import { LoginContent } from '@/_components/LoginContent';

// Standalone route (deep link, post-logout redirect, etc.) — plays the full
// entrance animation including its initial hold. When arriving straight from
// the splash video instead, app/index.tsx renders <LoginContent
// skipInitialHold /> directly in place rather than navigating here — see
// that file for why.
export default function LoginScreen() {
  return <LoginContent />;
}

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { router } from 'expo-router';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; errorMessage: string };

// Catches render-time crashes anywhere below it so one broken screen
// doesn't take down the whole app. This sits once at the root (_layout.tsx),
// so "Try Again" must actually navigate away from whatever screen crashed —
// just clearing local state and re-rendering the same tree would hit the
// same bad data (a corrupt nav param, an unexpected API shape) and crash
// again immediately, trapping the user on this card forever.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log('[ErrorBoundary] Caught crash:', error.message, info.componentStack);
  }

  handleGoToJobs = () => {
    this.setState({ hasError: false, errorMessage: '' });
    // Reset the whole navigation stack back to a known-good screen instead
    // of just re-rendering in place, so the crashing screen isn't still
    // sitting underneath waiting to be returned to. dismissAll() only
    // makes sense when there's something behind this screen to dismiss —
    // if the crash happened on the very first screen in the stack (nothing
    // to pop to), it logs a "POP_TO_TOP not handled" dev warning instead of
    // silently no-op'ing. canDismiss() guards that; replace() below still
    // always runs either way.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/screens/dashboard');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app hit an unexpected error. Please try again.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleGoToJobs}>
            <Text style={styles.buttonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 30,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#F26722',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

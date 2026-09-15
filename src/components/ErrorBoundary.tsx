import { Component, ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Without this, an uncaught error thrown while the app is still mounting
 * (e.g. during Firebase/auth setup) can leave the native splash screen
 * frozen forever with nothing visible to explain why - especially on
 * Android release/Hermes builds, which don't always show a red-box.
 * This guarantees *something* renders so the failure is visible and
 * diagnosable instead of looking like a stuck splash.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed during startup:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1120", padding: 24 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  message: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#6366F1", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: "#fff", fontWeight: "700" },
});

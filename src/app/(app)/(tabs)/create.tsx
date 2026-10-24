import { Redirect } from 'expo-router';

/** The Create tab opens the composer modal; this route only exists for the tab. */
export default function CreateTab() {
  return <Redirect href="/compose" />;
}

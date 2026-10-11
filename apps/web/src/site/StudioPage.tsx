import { EntryGate } from '../components/EntryGate';
import { useDocumentTitle } from '../lib/router';
import { Studio } from '../studio/Studio';

/** Prompt Studio: terms (first visit only), then the voice tool. Loaded as its own gated bundle. */
export default function StudioPage() {
  useDocumentTitle('Prompt Studio · Prompt IQ');
  return <EntryGate label="Prompt Studio">{() => <Studio />}</EntryGate>;
}

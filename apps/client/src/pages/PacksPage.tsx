import { Panel } from '../components/Panel.js';
import { PackShelf } from './PackShelf.js';

/** Placeholder shop counter; buying and opening packs arrive in T12. */
export function PacksPage() {
  return (
    <>
      <h1 className="page-title">Packs</h1>
      <Panel material="wood">
        <h2>The shop counter</h2>
        <PackShelf />
        <p className="muted small">
          The shopkeeper is still dusting the shelf. Opening packs comes next.
        </p>
      </Panel>
    </>
  );
}

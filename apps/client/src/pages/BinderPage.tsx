import { Link } from 'react-router';
import { CardBack } from '../components/Card.js';
import { Panel } from '../components/Panel.js';

/** Placeholder binder with an empty state; the real binder is T15. */
export function BinderPage() {
  return (
    <>
      <h1 className="page-title">Binder</h1>
      <Panel className="empty">
        <CardBack className="empty__art" />
        <div>
          <h2>Nothing tucked in yet</h2>
          <p>Your binder is waiting for its first card. Open a pack and it will find its page.</p>
          <Link className="btn" to="/packs">
            Find a pack
          </Link>
        </div>
      </Panel>
    </>
  );
}

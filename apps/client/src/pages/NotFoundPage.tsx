import { Link } from 'react-router';
import { Panel } from '../components/Panel.js';

export function NotFoundPage() {
  return (
    <Panel className="narrow">
      <h2>This path is overgrown</h2>
      <p>Nothing lives here. Let&apos;s head back to the cottage.</p>
      <Link className="btn" to="/">
        Go home
      </Link>
    </Panel>
  );
}

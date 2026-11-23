import { Link } from 'react-router';
import { Icon } from '../components/Icon.js';
import { Panel } from '../components/Panel.js';
import { PackShelf } from './PackShelf.js';

/** Placeholder home; the real one (timer, daily, quests, season bar) is T16. */
export function HomePage() {
  return (
    <>
      <h1 className="page-title">Welcome home</h1>
      <div className="split">
        <Panel className="pinned">
          <h2>The Wandering Post</h2>
          <div className="timer">
            <Icon name="timer" scale={3} />
            <span className="num">Soon</span>
          </div>
          <p>A moth courier is sorting your mail. Your first satchel of cards is on its way.</p>
          <Link className="btn" to="/packs">
            See the packs
          </Link>
        </Panel>
        <Panel material="wood">
          <h2>Pack shelf</h2>
          <PackShelf />
        </Panel>
      </div>
    </>
  );
}

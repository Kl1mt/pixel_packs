import { NavLink } from 'react-router';

/** Binder and pull history live behind the one "Binder" nav item (GDD §16: M1 nav stays at 3). */
export function BinderTabs() {
  return (
    <nav className="binder-tabs" aria-label="Binder sections">
      <NavLink to="/binder" end className="binder-tabs__link">
        Cards
      </NavLink>
      <NavLink to="/binder/history" className="binder-tabs__link">
        Pull history
      </NavLink>
    </nav>
  );
}

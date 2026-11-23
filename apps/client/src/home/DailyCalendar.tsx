import type { EconomyState } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { Panel } from '../components/Panel.js';
import { calendarTiles } from './format.js';

export interface DailyCalendarProps {
  calendar: EconomyState['calendar'];
  busy: boolean;
  onClaim: () => void;
}

const STATUS_TEXT = { claimed: 'claimed', today: 'ready today', next: 'tomorrow', later: 'later' };

/** The 7-day calendar (GDD §8): stamped days, today's gift, and what comes later. */
export function DailyCalendar({ calendar, busy, onClaim }: DailyCalendarProps) {
  const tiles = calendarTiles(calendar);
  return (
    <Panel className="home-daily" aria-label="Daily calendar">
      <h2>Daily post</h2>
      <ol className="calendar">
        {tiles.map((t) => (
          <li
            key={t.day}
            className={`calendar__day calendar__day--${t.status}`}
            aria-label={`Day ${String(t.day)}, ${STATUS_TEXT[t.status]}`}
          >
            <span className="calendar__n num" aria-hidden="true">
              {t.day}
            </span>
            {t.gold > 0 && <CurrencyBadge currency="gold" amount={t.gold} />}
            {t.dust > 0 && <CurrencyBadge currency="dust" amount={t.dust} />}
            {t.status === 'claimed' && (
              <span className="calendar__stamp" aria-hidden="true">
                Got it
              </span>
            )}
          </li>
        ))}
      </ol>
      {calendar.claimedToday ? (
        <p className="small muted">Today&rsquo;s letter is opened. Come back tomorrow.</p>
      ) : (
        <Button onClick={onClaim} disabled={busy}>
          Open today&rsquo;s letter
        </Button>
      )}
    </Panel>
  );
}

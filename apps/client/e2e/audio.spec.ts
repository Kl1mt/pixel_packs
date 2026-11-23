import { expect, test, type Page } from '@playwright/test';
import { loggedIn } from './helpers.js';

interface AudioProbe {
  unlocked: boolean;
  sfxState: () => string;
  music: () => string | null;
  log: () => readonly string[];
}

const probe = (page: Page) =>
  page.evaluate(() => {
    const a = (window as unknown as { __pixelPacksAudio: AudioProbe }).__pixelPacksAudio;
    return { unlocked: a.unlocked, sfx: a.sfxState(), music: a.music(), log: [...a.log()] };
  });

test.describe('audio', () => {
  test('unlocks on first input, plays UI and opening sounds, keeps mute and volumes', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await loggedIn(page);
    await page.goto('/settings');
    expect((await probe(page)).unlocked).toBe(false);

    // First press: the sprite loads, home music starts, the press sounds.
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(async () => (await probe(page)).sfx).toBe('loaded');
    const first = await probe(page);
    expect(first.music).toBe('home');
    expect(first.log).toContain('ui.press');

    // Mute and SFX volume persist.
    await page.getByLabel('Mute all sound').check();
    await page.getByRole('slider', { name: /Sound effects/ }).fill('35');
    await page.reload();
    await expect(page.getByLabel('Mute all sound')).toBeChecked();
    await expect(page.getByRole('slider', { name: /Sound effects/ })).toHaveValue('35');
    await page.getByLabel('Mute all sound').uncheck();

    // Opening: tear, slide, flip + rarity stinger, opening music, then back home.
    await page.goto('/packs');
    const star = page.getByRole('listitem', { name: 'Starhollow pack' });
    await star.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Tear it open' }).click();
    const scene = page.getByRole('dialog', { name: 'Opening a Starhollow pack' });
    await expect(scene).toHaveAttribute('data-phase', 'reveal');
    await page.getByTestId('card-stack').click();
    await expect.poll(async () => (await probe(page)).music).toBe('opening');
    const opened = (await probe(page)).log;
    expect(opened).toEqual(expect.arrayContaining(['open.tear', 'open.slide', 'open.flip']));
    expect(opened.some((id) => id.startsWith('rarity.'))).toBe(true);
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'Back to the shelf' }).click();
    await expect(scene).toBeHidden();
    await expect.poll(async () => (await probe(page)).music).toBe('home');
    expect(errors).toEqual([]);
  });

  test('a Legendary Foil moment plays its beats: swell, rays, whoosh, crest, glint', async ({
    page,
  }) => {
    await page.goto('/debug/moments?rarity=legendary&variant=foil&fx=full');
    // The first press unlocks audio; Replay restarts the moment so every beat sounds.
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect.poll(async () => (await probe(page)).sfx).toBe('loaded');
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect
      .poll(async () => (await probe(page)).log, { timeout: 8000 })
      .toEqual(
        expect.arrayContaining([
          'moment.swell',
          'moment.rays',
          'moment.whoosh',
          'rarity.legendary',
          'variant.foil',
        ]),
      );
  });
});

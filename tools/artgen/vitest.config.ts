import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'artgen', include: ['src/**/*.test.ts'] },
});

import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'econ-sim', include: ['src/**/*.test.ts'] },
});

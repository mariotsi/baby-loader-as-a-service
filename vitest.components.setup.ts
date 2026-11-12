import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmounts what each test rendered. Testing Library does this by itself only
// when the runner's `afterEach` is a global, and this project imports it.
afterEach(cleanup);

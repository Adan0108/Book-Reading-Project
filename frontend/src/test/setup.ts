import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
URL.createObjectURL = vi.fn(() => `blob:${crypto.randomUUID()}`);
URL.revokeObjectURL = vi.fn();
// jsdom has no native dialog top layer; browser E2E verifies the real interaction.
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};

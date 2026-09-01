import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlobalLoadingIndicator } from './GlobalLoadingIndicator.js';
import { beginTrackedRequest, getRequestTrackerSnapshot } from '../lib/requestTracker.js';
import { AppQueryProvider } from '../lib/query.js';

describe('GlobalLoadingIndicator & requestTracker', () => {
  it('updates request tracker state when requests start and end', () => {
    expect(getRequestTrackerSnapshot().isPending).toBe(false);
    expect(getRequestTrackerSnapshot().activeCount).toBe(0);

    const endReq1 = beginTrackedRequest();
    expect(getRequestTrackerSnapshot().isPending).toBe(true);
    expect(getRequestTrackerSnapshot().activeCount).toBe(1);

    const endReq2 = beginTrackedRequest();
    expect(getRequestTrackerSnapshot().activeCount).toBe(2);

    endReq1();
    expect(getRequestTrackerSnapshot().activeCount).toBe(1);
    expect(getRequestTrackerSnapshot().isPending).toBe(true);

    endReq2();
    expect(getRequestTrackerSnapshot().activeCount).toBe(0);
    expect(getRequestTrackerSnapshot().isPending).toBe(false);
  });

  it('renders without throwing in initial state', () => {
    const markup = renderToStaticMarkup(<AppQueryProvider><GlobalLoadingIndicator /></AppQueryProvider>);
    expect(typeof markup).toBe('string');
  });
});

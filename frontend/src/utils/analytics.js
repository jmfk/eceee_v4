/**
 * ECEEE Statistics Tracking Library
 * Handles client-side event collection, batching, and reporting.
 */

import { getSessionId } from './sessionId';

class Analytics {
  constructor(config = {}) {
    this.tenantId = config.tenantId || null;
    this.endpoint = config.endpoint || '/api/statistics/ingest/';
    this.batchSize = config.batchSize || 10;
    this.batchInterval = config.batchInterval || 5000; // 5 seconds
    this.queue = [];
    this.userId = this._getOrCreateUserId();
    this.timer = null;
    this.initialized = false;
  }

  init(tenantId) {
    if (this.initialized) return;
    this.tenantId = tenantId;
    this._setupAutoTrack();
    this._startTimer();
    this.initialized = true;
    this.track('pageview');
  }

  track(eventType, metadata = {}) {
    if (!this.tenantId) {
      console.warn('ECEEE Analytics: Tenant ID not set. Call init(tenantId) first.');
      return;
    }

    const event = {
      userId: this.userId,
      sessionId: getSessionId(),
      eventType,
      eventTime: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      metadata,
    };

    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.queue.length === 0) return;

    const eventsToFlush = [...this.queue];
    this.queue = [];

    const payload = {
      tenantId: this.tenantId,
      events: eventsToFlush,
    };

    fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantId,
      },
      body: JSON.stringify(payload),
    }).catch(err => {
      console.error('ECEEE Analytics: Failed to flush events', err);
      // Put events back at the beginning of the queue
      this.queue = [...eventsToFlush, ...this.queue];
    });
  }

  _getOrCreateUserId() {
    let userId = localStorage.getItem('eceee_analytics_user_id');
    if (!userId) {
      userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('eceee_analytics_user_id', userId);
    }
    return userId;
  }

  _startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), this.batchInterval);
  }

  _setupAutoTrack() {
    // Scroll depth tracking
    let maxScroll = 0;
    const trackScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight;
      const totalHeight = document.documentElement.scrollHeight;
      const scrollPercent = Math.round((scrollPos / totalHeight) * 100);
      
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        if (maxScroll % 25 === 0) { // Track every 25%
           this.track('scroll_depth', { depth: maxScroll });
        }
      }
    };

    window.addEventListener('scroll', this._throttle(trackScroll, 1000));

    // Click tracking on data-track elements
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-track]');
      if (target) {
        const trackName = target.getAttribute('data-track');
        const trackMetadata = target.getAttribute('data-track-metadata');
        this.track('click', {
          name: trackName,
          metadata: trackMetadata ? JSON.parse(trackMetadata) : {}
        });
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  _throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }
}

const analytics = new Analytics();
export default analytics;


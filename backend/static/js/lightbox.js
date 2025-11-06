/**
 * Lightweight Vanilla JS Lightbox
 * No dependencies - works with data-lightbox attributes
 * Supports single images and grouped galleries (carousel mode)
 */
(function() {
  'use strict';

  const Lightbox = {
      isOpen: false,
    currentIndex: 0,
      items: [],
      group: null,
    
    elements: {
      overlay: null,
      image: null,
      caption: null,
      counter: null,
      closeBtn: null,
      prevBtn: null,
      nextBtn: null
    },

    // Touch support for mobile swipe
    touchStartX: 0,
    touchEndX: 0,

      init() {
      // Cache DOM elements
      this.elements.overlay = document.getElementById('lightbox-overlay');
      this.elements.image = document.getElementById('lightbox-image');
      this.elements.caption = document.getElementById('lightbox-caption');
      this.elements.counter = document.getElementById('lightbox-counter');
      this.elements.closeBtn = document.getElementById('lightbox-close');
      this.elements.prevBtn = document.getElementById('lightbox-prev');
      this.elements.nextBtn = document.getElementById('lightbox-next');

      // Event listeners
      this.bindEvents();
      
      // Expose globally for HTMX compatibility
        window.__lb = this;
    },

    bindEvents() {
      // Click delegation for data-lightbox triggers
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-lightbox]');
        if (trigger) {
          e.preventDefault();
          this.openFromTrigger(trigger);
        }
      });

      // Close button
      if (this.elements.closeBtn) {
        this.elements.closeBtn.addEventListener('click', () => this.close());
      }

      // Navigation buttons
      if (this.elements.prevBtn) {
        this.elements.prevBtn.addEventListener('click', () => this.prev());
      }
      if (this.elements.nextBtn) {
        this.elements.nextBtn.addEventListener('click', () => this.next());
      }

      // Click overlay to close
      if (this.elements.overlay) {
        this.elements.overlay.addEventListener('click', (e) => {
          if (e.target === this.elements.overlay) {
            this.close();
          }
        });
      }

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen) return;
        
        switch(e.key) {
          case 'Escape':
            this.close();
            break;
          case 'ArrowLeft':
            this.prev();
            break;
          case 'ArrowRight':
            this.next();
            break;
        }
      });

      // Touch events for mobile swipe
      if (this.elements.overlay) {
        this.elements.overlay.addEventListener('touchstart', (e) => {
          this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.elements.overlay.addEventListener('touchend', (e) => {
          this.touchEndX = e.changedTouches[0].screenX;
          this.handleSwipe();
        }, { passive: true });
      }
    },

    handleSwipe() {
      const swipeThreshold = 50;
      const diff = this.touchStartX - this.touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          this.next(); // Swipe left
        } else {
          this.prev(); // Swipe right
        }
      }
    },

    openFromTrigger(trigger) {
      const src = trigger.getAttribute('data-lightbox-src') || 
                  trigger.getAttribute('href') || '';
      const caption = trigger.getAttribute('data-lightbox-caption') || 
                     trigger.getAttribute('title') || 
                     trigger.getAttribute('aria-label') || '';
      const alt = trigger.getAttribute('data-lightbox-alt') || 
                 trigger.getAttribute('alt') || '';
      const group = trigger.getAttribute('data-lightbox-group') || '';

      // Build items array
      let items = [];
      let index = 0;

      if (group) {
        // Find all images in the same group
        const groupTriggers = Array.from(
          document.querySelectorAll(`[data-lightbox][data-lightbox-group="${CSS.escape(group)}"]`)
        );
        
        items = groupTriggers.map(node => ({
          src: node.getAttribute('data-lightbox-src') || node.getAttribute('href') || '',
          caption: node.getAttribute('data-lightbox-caption') || 
                  node.getAttribute('title') || 
                  node.getAttribute('aria-label') || '',
          alt: node.getAttribute('data-lightbox-alt') || node.getAttribute('alt') || ''
        }));
        
        index = Math.max(0, groupTriggers.indexOf(trigger));
      } else {
        // Single image
        items = [{ src, caption, alt }];
        index = 0;
      }

      this.open(items, index, group);
    },

    openFromParams(payload) {
      // For HTMX/programmatic API
      const items = payload.items && Array.isArray(payload.items) ? payload.items : 
                   [{ src: payload.src || '', caption: payload.caption || '', alt: payload.alt || '' }];
      const index = typeof payload.index === 'number' ? payload.index : 0;
      const group = payload.group || null;

      this.open(items, index, group);
    },

    open(items, index, group) {
      if (!items || items.length === 0) return;

      this.items = items;
      this.currentIndex = Math.max(0, Math.min(items.length - 1, index));
      this.group = group;
      this.isOpen = true;

      // Show overlay
      if (this.elements.overlay) {
        this.elements.overlay.style.display = 'flex';
        // Trigger reflow for transition
        this.elements.overlay.offsetHeight;
        this.elements.overlay.classList.add('lightbox-active');
      }

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Update content
      this.updateContent();

      // Update navigation visibility
      this.updateNavigation();
    },

    close() {
      this.isOpen = false;
      
      if (this.elements.overlay) {
        this.elements.overlay.classList.remove('lightbox-active');
        // Wait for transition
        setTimeout(() => {
          this.elements.overlay.style.display = 'none';
        }, 300);
      }

      // Restore body scroll
      document.body.style.overflow = '';

      // Clear data
      this.items = [];
      this.currentIndex = 0;
      this.group = null;
    },

    next() {
      if (this.items.length <= 1) return;
      this.currentIndex = (this.currentIndex + 1) % this.items.length;
      this.updateContent();
    },

    prev() {
      if (this.items.length <= 1) return;
      this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
      this.updateContent();
    },

    updateContent() {
      const item = this.items[this.currentIndex];
      if (!item) return;

      // Update image
      if (this.elements.image) {
        this.elements.image.src = item.src;
        this.elements.image.alt = item.alt || item.caption || '';
      }

      // Update caption
      if (this.elements.caption) {
        this.elements.caption.textContent = item.caption || item.alt || '';
        this.elements.caption.style.display = (item.caption || item.alt) ? 'block' : 'none';
      }

      // Update counter
      if (this.elements.counter) {
        if (this.items.length > 1) {
          this.elements.counter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
          this.elements.counter.style.display = 'block';
        } else {
          this.elements.counter.style.display = 'none';
        }
      }
    },

    updateNavigation() {
      const hasMultiple = this.items.length > 1;
      
      if (this.elements.prevBtn) {
        this.elements.prevBtn.style.display = hasMultiple ? 'flex' : 'none';
      }
      if (this.elements.nextBtn) {
        this.elements.nextBtn.style.display = hasMultiple ? 'flex' : 'none';
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Lightbox.init());
  } else {
    Lightbox.init();
  }

  // For HTMX dynamic content
  document.addEventListener('htmx:afterSwap', () => {
    // Re-scan for data-lightbox triggers (handled by event delegation automatically)
  });

})();

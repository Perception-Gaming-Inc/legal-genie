'use strict';
/**
 * Minimal Modal/Toast implementation mirroring the small subset of the
 * Bootstrap JS API this app relies on (`new bootstrap.Modal(el).show()/hide()`,
 * `new bootstrap.Toast(el,{delay}).show()`, and the `hidden.bs.modal` /
 * `hidden.bs.toast` events). Kept dependency-free so the app has no external
 * CDN/network requirement at runtime.
 */
window.bootstrap = {
  Modal: class {
    constructor(el) { this.el = el; }
    show() {
      document.body.classList.add('modal-open-body');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
      backdrop.addEventListener('click', () => this.hide());
      this.el.classList.add('show');
      this.el.querySelectorAll('[data-bs-dismiss="modal"]').forEach((btn) => btn.addEventListener('click', () => this.hide()));
      this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
      document.addEventListener('keydown', this._escHandler);
    }
    hide() {
      this.el.classList.remove('show');
      if (this.backdrop) this.backdrop.remove();
      document.body.classList.remove('modal-open-body');
      if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
      this.el.dispatchEvent(new Event('hidden.bs.modal'));
    }
  },
  Toast: class {
    constructor(el, opts = {}) { this.el = el; this.delay = opts.delay || 3000; }
    show() {
      this.el.classList.add('show');
      this.el.querySelectorAll('[data-bs-dismiss="toast"]').forEach((btn) => btn.addEventListener('click', () => this.hide()));
      this._timer = setTimeout(() => this.hide(), this.delay);
    }
    hide() {
      clearTimeout(this._timer);
      this.el.classList.remove('show');
      this.el.dispatchEvent(new Event('hidden.bs.toast'));
    }
  },
};

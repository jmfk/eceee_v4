export const PUBLIC_RENDER_CSS = `
html,body,#root{margin:0;min-height:100%;background:#fff}body{font-family:system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}.site-renderer{min-height:100vh}.widget-item{position:relative}
.site-renderer .layout-slot{position:relative;display:flex;flex-direction:column;gap:0;min-height:0}
.site-renderer .layout-slot>.widget-item:not(:last-child)>.banner-widget{margin-bottom:30px}
.two-columns-widget{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.three-columns-widget{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.hero-widget,.banner-widget,.content-card-widget,.bio-widget{position:relative}.hero-background,.image-widget img,.content-card-widget img,.bio-widget img{max-width:100%;height:auto}.navbar-widget{min-height:28px}.navbar-desktop-menu{display:flex;position:relative;justify-content:space-between;align-items:center;height:28px;width:100%}.navbar-menu-list{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0 0 0 20px;align-items:center}.navbar-secondary-menu{margin-left:auto;padding-left:0}.navbar-mobile-menu{position:absolute;top:100%;left:0;width:16rem;background:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);z-index:50;border:1px solid #e5e7eb;padding:.5rem 0}.navbar-mobile-menu a{display:block;padding:.5rem 1rem;font-size:.875rem;color:#374151;text-decoration:none}
.forms-widget{display:grid;gap:12px}.forms-widget label{display:grid;gap:4px}.table-cell-content{display:contents}.table-widget{overflow:auto}.table-widget table{width:100%;border-collapse:collapse}.table-widget th,.table-widget td{padding:8px;border:1px solid #d1d5db;text-align:left}
.news-items{display:grid;gap:18px}.news-item{display:grid;gap:12px}.render-error-state{border:1px solid #fecaca;background:#fef2f2}
@media(max-width:767px){.two-columns-widget,.three-columns-widget{grid-template-columns:1fr}.navbar-widget{height:26px;min-height:26px}}
`

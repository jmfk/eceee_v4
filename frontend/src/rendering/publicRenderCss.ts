export const PUBLIC_RENDER_CSS = `
html,body,#root{margin:0;min-height:100%;background:#fff}body{font-family:system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}.site-renderer{min-height:100vh}.widget-item{position:relative}
.site-renderer .layout-slot{position:relative;display:flex;flex-direction:column;gap:0;min-height:0}
.site-renderer .layout-slot>.widget-item:not(:last-child)>.banner-widget{margin-bottom:30px}
.content-widget{box-sizing:border-box;width:100%;min-height:32px;font-family:inherit;line-height:1.6;color:inherit;margin-bottom:30px}
.content-widget.border-enabled{padding-top:50px;padding-bottom:50px;outline:1px solid rgb(0 0 0/.3)}
.content-widget .media-insert,.content-widget .media-insert img{max-width:100%}.content-widget .media-insert img{height:auto}
.banner-widget{box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:140px;outline:1px solid rgb(0 0 0/.3);border-width:0;overflow:hidden;border-radius:0;box-shadow:none;margin-bottom:30px;position:relative}
.banner-widget.border-disabled{outline:none;border:none}.banner-widget:last-child{margin-bottom:0}
.banner-background{position:absolute;inset:0;width:100%;height:100%;background-size:cover;background-position:center;background-repeat:no-repeat;z-index:0}
.banner-body{display:flex;flex:1;min-height:0;height:140px;position:relative;z-index:1}.banner-body.mode-text{justify-content:flex-start;align-items:flex-start}
.banner-body.mode-text .banner-text{flex:1;padding:26px 30px 30px;font-size:16px;font-family:'Source Sans 3',sans-serif;font-weight:300;line-height:22px;overflow:hidden}
.banner-body.mode-text .banner-text h3{font-size:18px;font-family:'Source Sans 3',sans-serif;font-weight:700;line-height:22px;overflow:hidden;margin:0 0 3px}
.banner-body.mode-text .banner-text p{font-size:14px;font-family:'Source Sans 3',sans-serif;font-weight:300;line-height:17px;overflow:hidden;margin:0}
.banner-body.mode-text .banner-images{display:flex;justify-content:flex-end;padding:0}.banner-body.mode-header{justify-content:center;align-items:center}
.banner-body.mode-header .banner-text{width:100%;padding:30px;text-align:center;font-size:36px;font-family:'Source Sans 3',sans-serif;font-weight:500;line-height:32px;overflow:hidden;margin:0}
.banner-image{width:140px;height:140px;object-fit:cover;border:5px solid #fff}.banner-body.image-size-rectangle .banner-image{width:280px;height:140px;border:5px solid #fff}
.section-widget,.section-content-only-widget{margin-bottom:30px}.section-widget.border-enabled,.section-content-only-widget.border-enabled{outline:1px solid rgb(0 0 0/.3)}
.section-widget:last-child,.section-content-only-widget:last-child{margin-bottom:0}.section-header{padding:30px;user-select:none}
.section-remaining-content{display:block;margin-bottom:30px}.section-collapsed .section-remaining-content{display:none}
.section-banner{display:flex;align-items:center;justify-content:center;height:30px;outline:1px solid rgb(0 0 0/.3);border-width:0;overflow:hidden;border-radius:0;box-shadow:none;padding:0;cursor:pointer;user-select:none;transition:opacity .2s ease;font-size:16px;font-weight:300}
.section-banner:hover{opacity:.8}.contract-banner{display:flex}.section-collapsed .contract-banner{display:none}.expand-banner{display:none}.section-collapsed .expand-banner{display:flex}
.two-columns-widget{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.three-columns-widget{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.hero-widget,.banner-widget,.content-card-widget,.bio-widget{position:relative}.hero-background,.image-widget img,.content-card-widget img,.bio-widget img{max-width:100%;height:auto}.navbar-widget{min-height:28px}.navbar-desktop-menu{display:flex;position:relative;justify-content:space-between;align-items:center;height:28px;width:100%}.navbar-menu-list{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0 0 0 20px;align-items:center}.navbar-secondary-menu{margin-left:auto;padding-left:0}.navbar-mobile-menu{position:absolute;top:100%;left:0;width:16rem;background:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);z-index:50;border:1px solid #e5e7eb;padding:.5rem 0}.navbar-mobile-menu a{display:block;padding:.5rem 1rem;font-size:.875rem;color:#374151;text-decoration:none}
.forms-widget{display:grid;gap:12px}.forms-widget label{display:grid;gap:4px}.table-cell-content{display:contents}.table-widget{overflow:auto}.table-widget table{width:100%;border-collapse:collapse}.table-widget th,.table-widget td{padding:8px;border:1px solid #d1d5db;text-align:left}
.news-items{display:grid;gap:18px}.news-item{display:grid;gap:12px}.render-error-state{border:1px solid #fecaca;background:#fef2f2}
@media(max-width:768px){.banner-body.mode-text{flex-direction:column}}
@media(max-width:767px){.two-columns-widget,.three-columns-widget{grid-template-columns:1fr}.navbar-widget{height:26px;min-height:26px}}
`

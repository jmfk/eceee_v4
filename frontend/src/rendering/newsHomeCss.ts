export const NEWS_HOME_CSS = `
[data-widget-type="top-news-plug"] .news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
[data-widget-type="top-news-plug"].layout-1x3 .news-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
[data-widget-type="top-news-plug"] .news-card{min-width:0;min-height:260px;border:1px solid #d4dce2;border-radius:0;background:#fff;box-shadow:none;display:flex;flex-direction:column}
[data-widget-type="top-news-plug"] .news-card:hover{transform:none;box-shadow:none}
[data-widget-type="top-news-plug"] .news-image{order:2;margin-top:auto;align-self:flex-end;width:44%;height:auto;aspect-ratio:7 / 4;overflow:hidden}
[data-widget-type="top-news-plug"] .news-image.news-image-square{width:min(44%,105px);aspect-ratio:1}
[data-widget-type="top-news-plug"] .news-image img{width:100%;height:100%;object-fit:cover}
[data-widget-type="top-news-plug"] .news-body{display:contents}
[data-widget-type="top-news-plug"] .news-meta,[data-widget-type="top-news-plug"] .news-title,[data-widget-type="top-news-plug"] .news-excerpt,[data-widget-type="top-news-plug"] .news-footer{margin:0 16px}
[data-widget-type="top-news-plug"] .news-meta{order:0;margin-top:16px;font-size:.75rem;color:#596b78}
[data-widget-type="top-news-plug"] .news-title{order:1;margin-top:8px;font-size:1.3rem;line-height:1.25}
[data-widget-type="top-news-plug"] .news-excerpt{order:1;margin-top:8px;line-height:1.4}
[data-widget-type="top-news-plug"] .news-footer{order:3;margin-top:8px;margin-bottom:12px;font-size:.8rem}
[data-widget-type="top-news-plug"] a,[data-widget-type="sidebar-top-news"] a{color:inherit;text-decoration:none}
[data-widget-type="top-news-plug"] a:hover,[data-widget-type="sidebar-top-news"] a:hover{text-decoration:underline}
[data-widget-type="top-news-plug"] a:focus-visible,[data-widget-type="sidebar-top-news"] a:focus-visible{outline:2px solid #176da7;outline-offset:3px}
[data-widget-type="sidebar-top-news"] .news-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
[data-widget-type="sidebar-top-news"] .news-item{min-width:0}
[data-widget-type="sidebar-top-news"] .news-title{margin:0;font-size:1rem;line-height:1.3}
[data-widget-type="sidebar-top-news"] .news-thumbnail{width:72px;height:72px;float:right;margin-left:10px}
[data-widget-type="sidebar-top-news"] .news-thumbnail.news-image-landscape{width:126px;height:72px}
[data-widget-type="sidebar-top-news"] .news-thumbnail img{width:100%;height:100%;object-fit:cover}
[data-widget-type="sidebar-top-news"] .news-meta{font-size:.75rem;color:#596b78}
[data-widget-type="sidebar-top-news"].variant-header{display:flex;align-items:center;gap:12px;min-width:0;padding:0;border:0;border-radius:0;background:transparent}
[data-widget-type="sidebar-top-news"].variant-header .news-item{padding:0;border:0}
[data-widget-type="sidebar-top-news"].variant-header .widget-title{font-size:.8rem;white-space:nowrap;margin:0}
[data-widget-type="sidebar-top-news"].variant-header .news-list{display:flex;gap:14px;overflow:auto;white-space:nowrap;min-width:0}
[data-widget-type="sidebar-top-news"].variant-header .news-title{font-size:.8rem;font-weight:normal}
@media(max-width:640px){[data-widget-type="top-news-plug"] .news-grid,[data-widget-type="top-news-plug"].layout-1x3 .news-grid{grid-template-columns:1fr}[data-widget-type="top-news-plug"] .news-card{min-height:230px}}

.editorial-directory,.editorial-detail{color:inherit;font-family:inherit}.editorial-directory+.editorial-directory{margin-top:60px}
.editorial-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}
.editorial-section-title{font:inherit;font-size:22px;margin:0 0 30px}
.editorial-card{outline:1px solid currentColor;padding:30px;min-width:0;box-sizing:border-box;height:310px;overflow:hidden;display:flex;flex-direction:column}
.editorial-card h3{font-size:36px;font-weight:500;line-height:1.1;margin:0 0 24px;flex-shrink:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.editorial-card h3 a{color:inherit;font:inherit!important;line-height:inherit}
.editorial-card-body{display:flex;gap:30px;min-height:0;align-items:flex-end;margin-top:auto;width:100%}
.editorial-card-body p{font-size:16px;line-height:22px;font-weight:300;margin:0;flex:1;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.editorial-portrait{position:relative;overflow:hidden;flex:0 0 140px;height:140px}
.editorial-portrait img{width:100%;height:100%}
.editorial-compact .editorial-card{height:140px;padding:24px 30px;display:flex;flex-direction:row;align-items:center;gap:24px}
.editorial-compact .editorial-card h3{flex:1;font-size:22px;font-weight:600;margin:0}
.editorial-compact .editorial-portrait{height:140px;margin-right:-30px;flex-basis:140px}
.editorial-detail{margin-top:30px;outline:1px solid currentColor;padding:40px;display:flow-root}
.editorial-detail h1{font-size:41px;line-height:44px;font-weight:600;margin:0 0 50px}
.editorial-detail p,.editorial-detail dl{font-size:16px;line-height:22px;font-weight:300}
.editorial-profile-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:30px;align-items:end}
.editorial-profile-presentation{display:flex;gap:30px;align-items:flex-end;min-width:0}
.editorial-profile-presentation .editorial-body{flex:1}
.editorial-profile-photo{position:relative;overflow:hidden;flex:0 0 175px;width:175px;height:175px}
.editorial-profile-photo img{width:100%;height:100%}
.editorial-columnist-meta{min-width:0;margin:0;display:grid;gap:8px;font-size:16px;line-height:22px;font-weight:300}
.editorial-columnist-meta dt{font-weight:600}.editorial-columnist-meta dd{margin:0;overflow-wrap:anywhere}
.editorial-card .editorial-columnist-meta{flex:1;gap:6px;line-height:20px}
.editorial-card .editorial-columnist-meta>div{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.editorial-card .editorial-columnist-meta>div.editorial-latest-column{-webkit-line-clamp:2}
.editorial-card .editorial-columnist-meta dt,.editorial-card .editorial-columnist-meta dd{display:inline}
.editorial-card .editorial-columnist-meta dt::after{content:': '}
.editorial-body .content-widget>:last-child{margin-bottom:0}
.editorial-profile-presentation .editorial-body>[data-slot]:last-child>.widget-item:last-child .content-widget{margin-bottom:0}
.editorial-event-facts{margin:0 0 30px}
.editorial-event-facts>div{display:grid;grid-template-columns:100px 1fr;gap:20px;margin-bottom:8px}
.editorial-event-facts dt{font-weight:600}.editorial-event-facts dd{margin:0}
.editorial-body{min-width:0}.editorial-body img{max-width:100%}
@media(max-width:767px){.editorial-grid{grid-template-columns:1fr}.editorial-card{padding:24px}.editorial-card h3{font-size:30px}.editorial-portrait{flex-basis:100px;height:100px}.editorial-detail{padding:24px}.editorial-detail h1{font-size:30px;line-height:34px}.editorial-profile-layout{grid-template-columns:1fr;gap:30px}.editorial-profile-presentation{flex-direction:column;align-items:stretch}.editorial-profile-photo{width:140px;height:140px;flex-basis:auto;align-self:flex-end}.editorial-compact .editorial-card{padding:20px}.editorial-compact .editorial-portrait{margin-right:-20px;flex-basis:100px}}
`

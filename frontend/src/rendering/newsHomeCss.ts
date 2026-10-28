export const NEWS_HOME_CSS = `
[data-widget-type="top-news-plug"] .news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
[data-widget-type="top-news-plug"].layout-1x3 .news-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
[data-widget-type="top-news-plug"] .news-card{min-width:0;min-height:260px;border:1px solid #d4dce2;border-radius:0;background:#fff;box-shadow:none;display:flex;flex-direction:column}
[data-widget-type="top-news-plug"] .news-card:hover{transform:none;box-shadow:none}
[data-widget-type="top-news-plug"] .news-image{order:2;margin-top:auto;align-self:flex-end;width:44%;height:105px;overflow:hidden}
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
[data-widget-type="sidebar-top-news"] .news-thumbnail img{width:100%;height:100%;object-fit:cover}
[data-widget-type="sidebar-top-news"] .news-meta{font-size:.75rem;color:#596b78}
[data-widget-type="sidebar-top-news"].variant-header{display:flex;align-items:center;gap:12px;min-width:0;padding:0;border:0;border-radius:0;background:transparent}
[data-widget-type="sidebar-top-news"].variant-header .news-item{padding:0;border:0}
[data-widget-type="sidebar-top-news"].variant-header .widget-title{font-size:.8rem;white-space:nowrap;margin:0}
[data-widget-type="sidebar-top-news"].variant-header .news-list{display:flex;gap:14px;overflow:auto;white-space:nowrap;min-width:0}
[data-widget-type="sidebar-top-news"].variant-header .news-title{font-size:.8rem;font-weight:normal}
@media(max-width:640px){[data-widget-type="top-news-plug"] .news-grid,[data-widget-type="top-news-plug"].layout-1x3 .news-grid{grid-template-columns:1fr}[data-widget-type="top-news-plug"] .news-card{min-height:230px}}
`

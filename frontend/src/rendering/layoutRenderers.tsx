import type { LayoutRenderComponent } from './types'

const MainLayoutRender: LayoutRenderComponent = ({ renderSlot }) => (
    <div className="main-layout-container">
        <div className="main-layout-wrapper">
            <div className="layout-slot slot-header" data-slot-name="header">{renderSlot('header')}</div>
            <div className="layout-slot slot-navbar" data-slot-name="navbar">{renderSlot('navbar')}</div>
            <div className="layout-slot slot-hero" data-slot-name="hero">{renderSlot('hero')}</div>
            <div className="main-layout-grid">
                <main className="main-layout-main"><div className="layout-slot slot-main" data-slot-name="main">{renderSlot('main')}</div></main>
                <aside className="main-layout-aside"><div className="layout-slot slot-sidebar" data-slot-name="sidebar">{renderSlot('sidebar')}</div></aside>
            </div>
            <div className="main-layout-footer"><div className="layout-slot slot-footer" data-slot-name="footer">{renderSlot('footer')}</div></div>
        </div>
    </div>
)

const LandingPageRender: LayoutRenderComponent = ({ renderSlot }) => (
    <div className="landing-page-container">
        <div className="landing-page-wrapper">
            <div className="layout-slot slot-header" data-slot-name="header">{renderSlot('header')}</div>
            <div className="layout-slot slot-navbar" data-slot-name="navbar">{renderSlot('navbar')}</div>
            <div className="layout-slot slot-hero" data-slot-name="hero">{renderSlot('hero')}</div>
            <main className="landing-page-main"><div className="layout-slot slot-landing-page slot-landingPage" data-slot-name="landing_page">{renderSlot('landingPage')}</div></main>
            <div className="landing-page-footer"><div className="layout-slot slot-footer" data-slot-name="footer">{renderSlot('footer')}</div></div>
        </div>
    </div>
)

export const RENDER_LAYOUT_CSS = `
:root{--main-layout-bg-outer:#9ca3af;--main-layout-bg-white:#fff;--main-layout-max-width:1280px;--main-layout-gap:30px;--main-layout-padding-x:40px;--main-layout-padding-y:30px;--main-layout-footer-min-height:310px;--main-content-max-width-default:650px;--main-content-max-width-xl:790px;--main-sidebar-min-height:310px;--landing-bg-outer:#9ca3af;--landing-bg-white:#fff;--landing-max-width:1280px;--landing-spacing:30px;--landing-footer-min-height:310px;--landing-main-min-height:310px}
.main-layout-container,.landing-page-container{min-height:100vh;background-color:var(--main-layout-bg-outer);display:flex;flex-direction:column}
.main-layout-wrapper,.landing-page-wrapper{width:100%;max-width:1280px;margin-left:auto;margin-right:auto;flex:1;display:flex;flex-direction:column;background:#fff}
.main-layout-grid{display:grid;grid-template-columns:1fr;gap:var(--main-layout-gap);padding:var(--main-layout-padding-y) var(--main-layout-padding-x);flex:1;min-height:300px}
.main-layout-main{margin:0 auto;padding:0;max-width:var(--main-content-max-width-default)}
.main-layout-aside{display:grid;grid-template-columns:1fr;min-height:var(--main-sidebar-min-height);gap:var(--main-layout-gap)}
.main-layout-footer,.landing-page-footer{min-height:310px;display:flex;flex-direction:column}.main-layout-footer .slot-footer,.landing-page-footer .slot-footer{min-height:310px;flex:1;display:flex;flex-direction:column}
.landing-page-container{background-color:var(--landing-bg-outer)}.landing-page-wrapper{max-width:var(--landing-max-width);background-color:var(--landing-bg-white)}.landing-page-main{background-color:var(--landing-bg-white);padding:var(--landing-spacing);min-height:var(--landing-main-min-height)}
@media(min-width:768px){.main-layout-aside{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.main-layout-grid{grid-template-columns:repeat(3,1fr)}.main-layout-main{grid-column:span 2}.main-layout-aside{grid-column:span 1;grid-template-columns:1fr}}
@media(min-width:1280px){.main-layout-main{margin-left:0;margin-right:0;max-width:var(--main-content-max-width-xl)}}
`

export const RENDER_LAYOUT_COMPONENTS: Record<string, LayoutRenderComponent> = {
    main_layout: MainLayoutRender,
    landing_page: LandingPageRender,
}

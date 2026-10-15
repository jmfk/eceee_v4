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

export const RENDER_LAYOUT_COMPONENTS: Record<string, LayoutRenderComponent> = {
    main_layout: MainLayoutRender,
    landing_page: LandingPageRender,
}

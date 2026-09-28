import type { PublishedPageModel, Widget } from './model';
function StaticWidget({ widget }: { widget: Widget }) {
  const c = widget.config;
  if (c.is_visible === false || c.isVisible === false || c.is_active === false || c.isActive === false) return null;
  const value = (...keys: string[]) => keys.map(k => c[k]).find(v => typeof v === 'string' || typeof v === 'number');
  switch (widget.type) {
    case 'easy_widgets.HeadlineWidget': return <h2>{String(value('content', 'text', 'headline') ?? '')}</h2>;
    case 'easy_widgets.HeroWidget': return <section><h1>{String(value('header', 'title', 'headline') ?? '')}</h1></section>;
    case 'easy_widgets.ContentWidget': return <p style={{ whiteSpace: 'pre-wrap' }}>{String(value('content', 'html') ?? '')}</p>;
    default: return null;
  }
}
export function PublishedPage({ model }: { model: PublishedPageModel }) {
  const slot = (name: string) => model.slots[name]?.map(w => <StaticWidget key={w.id} widget={w} />);
  return <div className="site-renderer cms-content" data-render-layout={model.layout}>
    <header>{slot('header')}{slot('navbar')}</header>{slot('hero')}
    <main>{slot('main')}{slot('landingPage')}{slot('content')}</main>
    <aside>{slot('sidebar')}</aside><footer>{slot('footer')}</footer>
  </div>;
}

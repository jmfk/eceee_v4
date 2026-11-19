import { Services } from './services';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Products and member services', robots: { index: false, follow: false } };
export default function ServicesPage() { return <Services />; }

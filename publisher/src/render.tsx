'use client';

import PageRenderer from '../../frontend/src/rendering/PageRenderer';
import type { PublishedPageModel } from './model';

export function PublishedPage({ model }: { model: PublishedPageModel }) {
  return <PageRenderer model={model} />;
}

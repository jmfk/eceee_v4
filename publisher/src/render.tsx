'use client';

import { useSyncExternalStore } from 'react';
import PageRenderer from '../../frontend/src/rendering/PageRenderer';
import type { PublishedPageModel } from './model';

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function browserSearch() {
  return window.location.search;
}

export function publicFormResult(search: string): PublishedPageModel['context']['publicForms']['result'] {
  const query = new URLSearchParams(search);
  const status = query.get('form_status');
  const widgetId = query.get('form_widget');
  return (status === 'success' || status === 'error') && widgetId ? { widgetId, status } : undefined;
}

export function PublishedPage({ model }: { model: PublishedPageModel }) {
  const search = useSyncExternalStore(subscribeToLocation, browserSearch, () => '');
  const formResult = publicFormResult(search);
  const renderModel = formResult ? {
    ...model,
    context: {
      ...model.context,
      publicForms: { ...model.context.publicForms, result: formResult },
    },
  } : model;
  return <PageRenderer model={renderModel} />;
}

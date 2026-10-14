'use client';

import { useEffect } from 'react';

export default function ErrorPage() {
  useEffect(() => {
    if (window.location.pathname !== '/500') window.location.replace('/500');
  }, []);

  return <main><h1>Server error</h1></main>;
}

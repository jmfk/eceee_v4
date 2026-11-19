import { cache } from 'react';
import { database } from './db';
import { buildPublishedPageModel } from './model';
import { websiteInfo } from './website';
export const requestPage = cache(async (host: string, path: string) => {
  const model = await buildPublishedPageModel(database, host, path);
  return model ? { model, website: await websiteInfo(database, model, host) } : null;
});

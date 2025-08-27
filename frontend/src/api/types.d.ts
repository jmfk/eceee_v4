/**
 * TypeScript definitions for API functions to ensure proper Promise handling
 */

// Base API response types
export interface ApiResponse<T = any> {
  data?: T;
  results?: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
}

// API function return type that must be awaited
export type ApiPromise<T = any> = Promise<ApiResponse<T>>;

// Utility type to ensure API functions return promises
export type ApiFunction<TArgs extends any[] = any[], TReturn = any> = 
  (...args: TArgs) => ApiPromise<TReturn>;

// API client methods that return promises
export interface ApiClient {
  get: <T = any>(url: string, config?: any) => ApiPromise<T>;
  post: <T = any>(url: string, data?: any, config?: any) => ApiPromise<T>;
  put: <T = any>(url: string, data?: any, config?: any) => ApiPromise<T>;
  patch: <T = any>(url: string, data?: any, config?: any) => ApiPromise<T>;
  delete: <T = any>(url: string, config?: any) => ApiPromise<T>;
}

// Generic API module interface
export interface ApiModule<T = any> {
  list: ApiFunction<[any?], T[]>;
  get: ApiFunction<[string | number], T>;
  create: ApiFunction<[any], T>;
  update: ApiFunction<[string | number, any], T>;
  delete: ApiFunction<[string | number], void>;
}

// Specific API module types
export interface MediaCollectionsApi extends ApiModule<MediaCollection> {
  addMedia: ApiFunction<[string | number, string[]], void>;
  removeMedia: ApiFunction<[string | number, string[]], void>;
  getMedia: ApiFunction<[string | number, any?], MediaFile[]>;
}

export interface MediaTagsApi extends ApiModule<MediaTag> {
  bulkCreate: ApiFunction<[string[]], MediaTag[]>;
  bulkDelete: ApiFunction<[string[]], void>;
  getOrCreate: ApiFunction<[string], { tag: MediaTag; created: boolean }>;
}

// Media types
export interface MediaCollection {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaTag {
  id: string;
  name: string;
  namespace?: string;
  usageCount: number;
}

export interface MediaFile {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  collections: string[];
  uploadedAt: string;
}

// Helper type to ensure functions are awaited
export type MustAwait<T> = T extends Promise<infer U> ? Promise<U> : never;

// Utility to mark API calls as requiring await
export function requireAwait<T>(promise: Promise<T>): MustAwait<Promise<T>> {
  return promise as MustAwait<Promise<T>>;
}

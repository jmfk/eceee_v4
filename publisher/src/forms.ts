import { buildPublishedPageModel, type DbId, type ReadDb, type Widget } from './model';
import { RE2JS } from 're2js';

const FORM_WIDGET_TYPE = 'easy_widgets.FormsWidget';
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const MAX_FIELDS = 64;
const MAX_OPTIONS = 100;
const MAX_PATTERN_LENGTH = 512;
const MAX_VALUE_LENGTH = 10_000;
const CONTROL_FIELDS = new Set(['__page_path', '__website']);

type SubmittedValues = Record<string, string[]>;

export interface StoredFormSubmission {
  tenantId: DbId;
  pageId: DbId;
  versionId: DbId;
  widgetId: string;
  formTitle: string;
  data: Record<string, string | string[] | boolean>;
}

export interface FormSubmissionStore {
  insert(submission: StoredFormSubmission): Promise<'stored' | 'rate_limited'>;
}

export type FormSubmissionResult =
  | { status: 'success' | 'invalid' | 'rate_limited'; redirectPath: string }
  | { status: 'not_found' };

function record(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function configured(input: Record<string, unknown>, ...names: string[]): unknown {
  return names.map(name => input[name]).find(candidate => candidate !== undefined && candidate !== null);
}

function nestedWidgets(widget: Widget): Widget[] {
  const config = record(widget.config);
  const data = record(widget.data);
  const configuredItem = record(config.item);
  const dataItem = record(data.item);
  const groups: unknown[] = [config.widgets];
  for (const slots of [record(config.slots), record(configuredItem.widgets), record(dataItem.widgets)]) {
    groups.push(...Object.values(slots));
  }
  return groups.flatMap(group => Array.isArray(group) ? group as Widget[] : []);
}

export function findPublishedForm(slots: Record<string, Widget[]>, widgetId: string): Widget | null {
  const matches: Widget[] = [];
  const visited = new Set<Widget>();
  const visit = (widgets: Widget[]) => {
    for (const widget of widgets) {
      if (!widget || typeof widget !== 'object' || visited.has(widget)) continue;
      visited.add(widget);
      if (widget.id === widgetId && widget.type === FORM_WIDGET_TYPE) matches.push(widget);
      visit(nestedWidgets(widget));
    }
  };
  for (const widgets of Object.values(slots)) visit(widgets);
  return matches.length === 1 ? matches[0] : null;
}

function normalizedValues(input: SubmittedValues): SubmittedValues | null {
  const result: SubmittedValues = {};
  for (const [rawName, values] of Object.entries(input)) {
    if (CONTROL_FIELDS.has(rawName)) continue;
    if (rawName.startsWith('__')) return null;
    const name = rawName.endsWith('[]') ? rawName.slice(0, -2) : rawName;
    if (!FIELD_NAME.test(name)) return null;
    result[name] = [...(result[name] ?? []), ...values];
  }
  return result;
}

function integerRule(input: unknown, fallback: number): number {
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_VALUE_LENGTH ? parsed : fallback;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateFormValues(
  fieldsInput: unknown,
  submittedInput: SubmittedValues,
): Record<string, string | string[] | boolean> | null {
  if (!Array.isArray(fieldsInput) || fieldsInput.length < 1 || fieldsInput.length > MAX_FIELDS) return null;
  const submitted = normalizedValues(submittedInput);
  if (!submitted) return null;
  const output: Record<string, string | string[] | boolean> = {};
  const known = new Set<string>();

  for (const candidate of fieldsInput) {
    const field = record(candidate);
    const name = String(field.name ?? '');
    const type = String(field.type ?? 'text').toLowerCase();
    if (!FIELD_NAME.test(name) || name.startsWith('__') || known.has(name) || type === 'file') return null;
    known.add(name);

    const options = Array.isArray(field.options) ? field.options.map(String) : [];
    if (options.length > MAX_OPTIONS || new Set(options).size !== options.length || options.some(option => option.length > 500)) return null;
    if (['select', 'radio'].includes(type) && options.length === 0) return null;
    const values = submitted[name] ?? [];
    const required = field.required === true;

    if (type === 'checkbox' && options.length === 0) {
      if (values.length > 1 || values.some(value => value !== 'on' && value !== 'true')) return null;
      const checked = values.length === 1;
      if (required && !checked) return null;
      output[name] = checked;
      continue;
    }

    if (type === 'checkbox') {
      if (required && values.length === 0) return null;
      if (new Set(values).size !== values.length || values.some(value => !options.includes(value))) return null;
      output[name] = values;
      continue;
    }

    if (values.length > 1) return null;
    const value = values[0] ?? '';
    if (required && value.length === 0) return null;
    if (!required && value.length === 0) {
      output[name] = '';
      continue;
    }

    const validation = record(field.validation);
    const minLength = integerRule(validation.min_length ?? validation.minLength, 0);
    const maxLength = integerRule(validation.max_length ?? validation.maxLength, MAX_VALUE_LENGTH);
    if (value.length < minLength || value.length > Math.min(maxLength, MAX_VALUE_LENGTH)) return null;

    const pattern = validation.pattern;
    if (pattern !== undefined && pattern !== null) {
      if (typeof pattern !== 'string' || pattern.length > MAX_PATTERN_LENGTH) return null;
      try {
        if (!RE2JS.compile(pattern).testExact(value)) return null;
      } catch {
        return null;
      }
    }

    if (['select', 'radio'].includes(type) && (!options.length || !options.includes(value))) return null;
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    if (type === 'phone' && !/^[+0-9() .-]{3,40}$/.test(value)) return null;
    if (type === 'number' && (!/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) return null;
    if (type === 'date' && !validDate(value)) return null;
    if (type === 'time' && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null;
    if (!['text', 'email', 'phone', 'number', 'textarea', 'select', 'radio', 'date', 'time'].includes(type)) return null;
    output[name] = value;
  }

  return Object.keys(submitted).every(name => known.has(name)) ? output : null;
}

export async function submitPublishedForm(input: {
  readDb: ReadDb;
  store: FormSubmissionStore;
  hostname: string;
  pageId: string;
  widgetId: string;
  pagePath: string;
  values: SubmittedValues;
  honeypot: string;
  at?: Date;
}): Promise<FormSubmissionResult> {
  const model = await buildPublishedPageModel(input.readDb, input.hostname, input.pagePath, input.at);
  if (!model || model.context.pageId !== input.pageId) return { status: 'not_found' };
  const widget = findPublishedForm(model.slots, input.widgetId);
  if (!widget || configured(widget.config, 'storeSubmissions', 'store_submissions') === false) return { status: 'not_found' };

  const honeypotEnabled = configured(widget.config, 'honeypotProtection', 'honeypot_protection') !== false;
  if (honeypotEnabled && input.honeypot) return { status: 'success', redirectPath: model.matchedPath };

  const data = validateFormValues(configured(widget.config, 'fields'), input.values);
  if (!data) return { status: 'invalid', redirectPath: model.matchedPath };
  const stored = await input.store.insert({
    tenantId: model.context.tenantId,
    pageId: model.context.pageId,
    versionId: model.context.versionId,
    widgetId: widget.id,
    formTitle: String(configured(widget.config, 'title', 'formTitle', 'form_title') ?? '').slice(0, 255),
    data,
  });
  return { status: stored === 'stored' ? 'success' : 'rate_limited', redirectPath: model.matchedPath };
}

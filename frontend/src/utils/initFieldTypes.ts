import { fieldTypeRegistry } from './fieldTypeRegistry';
import { registerHtmlSourceField } from './fieldTypes';

export const initializeFieldTypes = () => {
  const registry = fieldTypeRegistry.getInstance();
  
  // Register the HTML source field type
  registerHtmlSourceField(registry);
  
  return registry;
};

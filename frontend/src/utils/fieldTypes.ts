import HtmlSourceField from '../components/fields/HtmlSourceField';

// Register the HTML source field type
export const registerHtmlSourceField = (registry: any) => {
  registry.register('HtmlSource', {
    component: HtmlSourceField,
    label: 'HTML Source Editor',
    description: 'Advanced HTML source editor with syntax highlighting',
    defaultProps: {
      rows: 6,
    },
  });
};
declare module '@uiw/react-codemirror' {
  import { ReactElement } from 'react';
  import { Extension } from '@codemirror/state';

  interface CodeMirrorProps {
    value?: string;
    height?: string;
    width?: string;
    theme?: Extension;
    extensions?: Extension[];
    onChange?: (value: string) => void;
    basicSetup?: {
      lineNumbers?: boolean;
      foldGutter?: boolean;
      highlightActiveLine?: boolean;
      autocompletion?: boolean;
      closeBrackets?: boolean;
      matchBrackets?: boolean;
      indentOnInput?: boolean;
    };
  }

  export default function CodeMirror(props: CodeMirrorProps): ReactElement;
}

declare module '@codemirror/lang-html' {
  import { Extension } from '@codemirror/state';
  export function html(): Extension;
}

declare module '@uiw/codemirror-theme-dracula' {
  import { Extension } from '@codemirror/state';
  export const dracula: Extension;
}

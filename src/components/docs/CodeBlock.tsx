'use client';

// ─────────────────────────────────────────────
// Lightweight syntax highlighter for JavaScript/TypeScript/Python code blocks
// ─────────────────────────────────────────────
export function highlight(code: string): string {
  // Escape HTML first
  let out = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Extract comments into placeholders first to prevent inner highlighting
  const comments: string[] = [];
  out = out.replace(/(\/\/[^\n]*|#[^\n]*)/g, (match) => {
    comments.push(`<span class="hl-comment">${match}</span>`);
    return `\x00COMMENT${comments.length - 1}\x00`;
  });

  // Extract strings into placeholders
  const strings: string[] = [];
  out = out.replace(/(`[^`]*`|"[^"]*"|'[^']*')/g, (match) => {
    strings.push(`<span class="hl-string">${match}</span>`);
    return `\x00STRING${strings.length - 1}\x00`;
  });

  // Numbers — use placeholders to avoid inner HTML getting re-matched
  const numbers: string[] = [];
  out = out.replace(/\b(\d+(\.\d+)?)\b/g, (match) => {
    numbers.push(`<span class="hl-number">${match}</span>`);
    return `\x00NUMBER${numbers.length - 1}\x00`;
  });
  // Keywords
  out = out.replace(
    /\b(function|return|const|let|var|if|else|for|while|new|true|false|null|undefined|import|export|default|interface|type|extends|implements|class|this|delete|typeof|instanceof|of|in|break|continue|switch|case|throw|try|catch|async|await|def|and|or|not|is|None|True|False|lambda|yield|pass|from|with|as|elif|except|finally|raise|del|global|nonlocal|in)\b/g,
    '<span class="hl-keyword">$1</span>',
  );
  // Built-in types
  out = out.replace(
    /\b(number|string|boolean|void|any|never|object|Array|Record|Set|Map|Promise|Math|Object|int|float|str|list|dict|tuple|bool|print|len|range|sum|min|max)\b/g,
    '<span class="hl-type">$1</span>',
  );

  // Restore placeholders (numbers, strings, comments — order matters)
  out = out.replace(/\x00NUMBER(\d+)\x00/g, (_, i) => numbers[Number(i)]);
  out = out.replace(/\x00STRING(\d+)\x00/g, (_, i) => strings[Number(i)]);
  out = out.replace(/\x00COMMENT(\d+)\x00/g, (_, i) => comments[Number(i)]);

  return out;
}

// ─────────────────────────────────────────────
// CodeBlock component
// ─────────────────────────────────────────────
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="code-block-wrapper">
      {label && <div className="code-label">{label}</div>}
      <pre className="code-block" dangerouslySetInnerHTML={{ __html: highlight(code.trim()) }} />
    </div>
  );
}

import { Fragment, type ReactNode } from "react";

// Renders WhatsApp formatting (*bold*, _italic_, ~strike~) and links as React
// nodes, without dangerouslySetInnerHTML.

const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g;

function inline(line: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(line.slice(last, at));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("http")) {
      out.push(
        <a key={k} href={t} target="_blank" rel="noreferrer" className="underline decoration-1 underline-offset-2 break-all">
          {t.replace(/^https?:\/\//, "")}
        </a>,
      );
    } else if (t.startsWith("*")) out.push(<strong key={k}>{t.slice(1, -1)}</strong>);
    else if (t.startsWith("_")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else out.push(<s key={k}>{t.slice(1, -1)}</s>);
    last = at + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function WaText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {inline(line, String(i))}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

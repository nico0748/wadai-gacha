import { loadDefaultJapaneseParser } from "budoux";
import { Fragment } from "react";

const parser = loadDefaultJapaneseParser();

/**
 * Japanese text that only wraps between phrases (BudouX), so a line never
 * breaks inside a word like 食べ/物. Needs a `jp-wrap` ancestor
 * (word-break: keep-all), which works in iOS Safari as well as Chrome.
 */
export function Phrase({ text }: { text: string }) {
  const parts = parser.parse(text);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

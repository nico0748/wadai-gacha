import { Fragment } from "react";
import { phrases } from "./cardDesign";

/**
 * Japanese text that only wraps between phrases (BudouX), so a line never
 * breaks inside a word like 食べ/物. Needs a `jp-wrap` ancestor
 * (word-break: keep-all), which works in iOS Safari as well as Chrome.
 *
 * `atomic` keeps each phrase in one piece even where the browser would break
 * at punctuation inside it (「動いた！」/の); a phrase longer than the line
 * still wraps. For short texts sized to fit, such as card topics.
 */
export function Phrase({ text, atomic = false }: { text: string; atomic?: boolean }) {
  const parts = phrases(text);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {atomic ? <span className="inline-block max-w-full">{part}</span> : part}
        </Fragment>
      ))}
    </>
  );
}

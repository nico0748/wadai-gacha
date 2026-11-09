import { Fragment } from "react";
import { phrases, topicPieces } from "./cardDesign";

/**
 * Japanese text that only wraps between phrases (BudouX), so a line never
 * breaks inside a word like 食べ/物. Needs a `jp-wrap` ancestor
 * (word-break: keep-all), which works in iOS Safari as well as Chrome.
 *
 * `atomic` is for card topics: the text is set in topicPieces (a long phrase
 * split again, a short last one joined to the one before), and each piece
 * stays in one piece even where the browser would break at punctuation
 * inside it (「動いた！」/の). A piece longer than the line (one very long
 * katakana word) still wraps, between any two characters a line may break
 * between, so not before ー or a small kana.
 */
export function Phrase({ text, atomic = false }: { text: string; atomic?: boolean }) {
  const parts = atomic ? topicPieces(text) : phrases(text);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {atomic ? <span className="inline-block max-w-full [word-break:normal]">{part}</span> : part}
        </Fragment>
      ))}
    </>
  );
}

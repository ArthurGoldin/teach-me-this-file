import { createElement } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

// Model and file text as Markdown: GFM tables and KaTeX math. Raw HTML is never rendered
// (react-markdown ignores it without rehype-raw), so neither the model nor a file can inject
// markup. Each block picks its own direction, so a Hebrew line next to a French one both read
// right; formulas are forced left to right in index.css (.katex).
// Every override drops react-markdown's `node` prop (the syntax tree) so it never reaches the DOM.
const auto =
  (tag) =>
  ({ node, ...props }) =>
    createElement(tag, { dir: 'auto', ...props })

const components = {
  p: auto('p'),
  // Headings inside a message are sub-headings of the chat, never page titles.
  li: auto('li'),
  h1: auto('h3'),
  h2: auto('h3'),
  h3: auto('h4'),
  h4: auto('h4'),
  blockquote: auto('blockquote'),
  // Wide tables scroll on their own instead of widening the whole chat on a phone.
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
  a: ({ node, children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex]

export default function Markdown({ text }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

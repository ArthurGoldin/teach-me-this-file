import { createElement } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { displayMath, linkHost } from './lessonFormat.js'

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
  li: auto('li'),
  // Headings inside a message are sub-headings of the chat, never page titles.
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
  // Nothing remote is loaded from model or file text: an image shows its alt text only (a
  // remote image could track the student), and a link names its site before anyone opens it.
  img: ({ alt }) => (alt ? <span className="italic">[{alt}]</span> : null),
  a: ({ href, children }) => {
    const host = linkHost(href)
    if (!host) return <span>{children}</span>
    return (
      <>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>{' '}
        <span className="text-[0.85em] opacity-70">({host})</span>
      </>
    )
  },
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
        {displayMath(text)}
      </ReactMarkdown>
    </div>
  )
}

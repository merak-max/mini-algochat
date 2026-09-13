import { useState } from "react";
import Markdown from "react-markdown";

export default function MessageContent({ text, markdown }) {
  const [copyStatus, setCopyStatus] = useState("Copy reply");
  if (!markdown) return text;

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy unavailable — select text instead");
    }
  }

  return <>
    <div className="markdown-content">
      <Markdown skipHtml components={{
        // Don't load third-party images automatically from model-generated text.
        img: ({ alt }) => <span>[Image: {alt || "not loaded"}]</span>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      }}>{text}</Markdown>
    </div>
    <button className="copy-reply" onClick={copyReply}>{copyStatus}</button>
  </>;
}

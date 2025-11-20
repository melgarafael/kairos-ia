"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/ui/cn";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUserMessage?: boolean;
}

export function MarkdownRenderer({ 
  content, 
  className,
  isUserMessage = false 
}: MarkdownRendererProps) {
  const textColor = isUserMessage ? "text-white" : "text-foreground/90";

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1 
              className={cn(
                "text-2xl font-semibold mt-6 mb-3 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          h2: ({ node, ...props }) => (
            <h2 
              className={cn(
                "text-xl font-semibold mt-5 mb-2 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          h3: ({ node, ...props }) => (
            <h3 
              className={cn(
                "text-lg font-semibold mt-4 mb-2 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          h4: ({ node, ...props }) => (
            <h4 
              className={cn(
                "text-base font-semibold mt-3 mb-1.5 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          h5: ({ node, ...props }) => (
            <h5 
              className={cn(
                "text-sm font-semibold mt-3 mb-1.5 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          h6: ({ node, ...props }) => (
            <h6 
              className={cn(
                "text-xs font-semibold mt-2 mb-1 first:mt-0",
                textColor
              )} 
              {...props} 
            />
          ),
          // Paragraph
          p: ({ node, ...props }) => (
            <p 
              className={cn(
                "text-[15px] leading-relaxed mb-3 last:mb-0",
                textColor
              )} 
              {...props} 
            />
          ),
          // Lists
          ul: ({ node, ...props }) => (
            <ul 
              className={cn(
                "list-disc list-inside mb-3 space-y-1.5 ml-2",
                textColor
              )} 
              {...props} 
            />
          ),
          ol: ({ node, ...props }) => (
            <ol 
              className={cn(
                "list-decimal list-inside mb-3 space-y-1.5 ml-2",
                textColor
              )} 
              {...props} 
            />
          ),
          li: ({ node, ...props }) => (
            <li 
              className={cn("text-[15px] leading-relaxed", textColor)} 
              {...props} 
            />
          ),
          // Code blocks
          code: ({ node, className: codeClassName, children, ...props }: any) => {
            // Inline code doesn't have language- prefix, block code does
            const isInline = !codeClassName || !codeClassName.includes("language-");
            
            if (isInline) {
              return (
                <code
                  className={cn(
                    "px-1.5 py-0.5 rounded text-sm font-mono",
                    isUserMessage 
                      ? "bg-white/20 text-white" 
                      : "bg-white/10 text-foreground/90"
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // Block code - styled differently
            return (
              <code
                className={cn(
                  "block p-3 rounded-lg text-sm font-mono overflow-x-auto",
                  isUserMessage 
                    ? "bg-white/10 text-white border border-white/20" 
                    : "bg-white/5 text-foreground/90 border border-white/10"
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, children, ...props }: any) => {
            // Pre contains code blocks, so we style it minimally
            return (
              <pre 
                className="mb-3 overflow-x-auto [&>code]:mb-0" 
                {...props}
              >
                {children}
              </pre>
            );
          },
          // Links
          a: ({ node, ...props }) => (
            <a
              className={cn(
                "underline underline-offset-2 hover:opacity-80 transition-opacity",
                isUserMessage ? "text-white" : "text-primary"
              )}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // Blockquote
          blockquote: ({ node, ...props }) => (
            <blockquote
              className={cn(
                "border-l-4 pl-4 my-3 italic",
                isUserMessage 
                  ? "border-white/30 text-white/90" 
                  : "border-foreground/20 text-foreground/80"
              )}
              {...props}
            />
          ),
          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr
              className={cn(
                "my-4 border-0 border-t",
                isUserMessage ? "border-white/20" : "border-white/10"
              )}
              {...props}
            />
          ),
          // Tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table
                className={cn(
                  "w-full border-collapse",
                  isUserMessage ? "border-white/20" : "border-white/10"
                )}
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead
              className={cn(
                "border-b-2",
                isUserMessage ? "border-white/20" : "border-white/10"
              )}
              {...props}
            />
          ),
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => (
            <tr
              className={cn(
                "border-b",
                isUserMessage ? "border-white/10" : "border-white/5"
              )}
              {...props}
            />
          ),
          th: ({ node, ...props }) => (
            <th
              className={cn(
                "px-4 py-2 text-left font-semibold",
                textColor
              )}
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className={cn(
                "px-4 py-2",
                textColor
              )}
              {...props}
            />
          ),
          // Strong/Bold
          strong: ({ node, ...props }) => (
            <strong 
              className={cn("font-semibold", textColor)} 
              {...props} 
            />
          ),
          // Emphasis/Italic
          em: ({ node, ...props }) => (
            <em 
              className={cn("italic", textColor)} 
              {...props} 
            />
          ),
          // Images
          img: ({ node, ...props }) => (
            <img
              className="max-w-full h-auto rounded-lg my-3"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


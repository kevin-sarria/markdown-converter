interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export default function Editor({ value, onChange }: EditorProps) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-[#0f1015]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Markdown
        </span>
        <span className="text-xs text-white/30">{value.length.toLocaleString()} caracteres</span>
      </div>
      <textarea
        className="flex-1 resize-none bg-transparent p-4 font-mono text-[13.5px] leading-relaxed text-white/85 outline-none placeholder:text-white/25"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="# Escribe tu Markdown aquí..."
      />
    </div>
  )
}

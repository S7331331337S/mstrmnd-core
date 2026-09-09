/**
 * Terminal-style MSTRMND mark — skills-TUI energy, platinum on obsidian.
 * Static pre block so it stays sharp in auth + empty states.
 */
const LINES = [
  " ███╗   ███╗███████╗████████╗██████╗ ███╗   ███╗███╗   ██╗██████╗ ",
  " ████╗ ████║██╔════╝╚══██╔══╝██╔══██╗████╗ ████║████╗  ██║██╔══██╗",
  " ██╔████╔██║███████╗   ██║   ██████╔╝██╔████╔██║██╔██╗ ██║██║  ██║",
  " ██║╚██╔╝██║╚════██║   ██║   ██╔══██╗██║╚██╔╝██║██║╚██╗██║██║  ██║",
  " ██║ ╚═╝ ██║███████║   ██║   ██║  ██║██║ ╚═╝ ██║██║ ╚████║██████╔╝",
  " ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═══╝╚═════╝ ",
] as const;

export function AsciiMark({
  tagline = "intelligence layer · not the model",
  className = "",
}: {
  tagline?: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto text-foreground ${className}`}
      role="img"
      aria-label="MSTRMND"
    >
      <pre className="mono m-0 inline-block min-w-max text-[9px] leading-[1.15] sm:text-[10px] tracking-normal select-none">
        {LINES.join("\n")}
      </pre>
      {tagline ? (
        <p className="label mt-2 mb-0 normal-case tracking-[0.22em]">{tagline}</p>
      ) : null}
    </div>
  );
}

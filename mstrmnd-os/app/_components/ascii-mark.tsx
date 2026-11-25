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
  fit = false,
}: {
  tagline?: string;
  className?: string;
  /**
   * Scale the mark to the width of its container (never scrolls, so no
   * scrollbar track under the logo) and use the legible tagline style.
   * Default keeps the original fixed-size, scrollable behaviour.
   */
  fit?: boolean;
}) {
  return (
    <div
      className={`${fit ? "" : "overflow-x-auto"} text-foreground ${className}`}
      style={fit ? { containerType: "inline-size" } : undefined}
      role="img"
      aria-label="MSTRMND"
    >
      <pre
        className={`mono m-0 inline-block min-w-max leading-[1.15] tracking-normal select-none ${
          fit ? "" : "text-[9px] sm:text-[10px]"
        }`}
        // 66 columns × 0.6em advance = 39.6em; 40 leaves a sliver of slack.
        style={fit ? { fontSize: "min(10px, calc(100cqw / 40))" } : undefined}
      >
        {LINES.join("\n")}
      </pre>
      {tagline ? (
        <p
          className={`${
            fit ? "label-legible px-1 tracking-[0.12em]" : "label tracking-[0.22em]"
          } mt-2 mb-0 normal-case`}
        >
          {tagline}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Line scanning shared by the `:::` container rules (columnsPlugin.ts and
 * canvasPlugin.ts).
 *
 * The reason this is not two loops of "find the closing line": both containers
 * have to step over fenced code blocks. Without that, a code sample that
 * contains a `:::` line — which is exactly what you write when documenting this
 * syntax — closes the container early and everything after it is dropped.
 */

export type LineReader = (n: number) => string

/** The opening or closing marker of a fenced code block, if this line is one. */
export function fenceMarkerOf(line: string): string | null {
  const match = line.trim().match(/^(`{3,}|~{3,})/)
  return match ? match[1] : null
}

/**
 * The line that closes the container, ignoring anything inside a fenced code
 * block. Returns -1 when there is no closing line.
 */
export function findFenceAwareClose(
  lineAt: LineReader,
  from: number,
  endLine: number,
  isClose: (line: string) => boolean,
): number {
  let fence: string | null = null

  for (let n = from; n < endLine; n++) {
    const line = lineAt(n)
    const marker = fenceMarkerOf(line)

    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      continue
    }
    if (marker) {
      fence = marker
      continue
    }
    if (isClose(line)) return n
  }

  return -1
}

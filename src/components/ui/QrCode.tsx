import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A QR code, drawn as SVG.
 *
 * WHY SVG AND NOT A CANVAS. This is a thing people point a phone at, and the
 * phone's camera resolves whatever the screen actually renders. A canvas is
 * fixed pixels — it blurs when scaled, on a high-density display, or when
 * somebody zooms in because the code will not scan. Vector rectangles stay
 * sharp at any size, which is precisely the property that decides whether the
 * scan works.
 *
 * WHY NOT AN IMAGE FROM A SERVICE. The `otpauth://` URI contains the account's
 * TOTP SECRET. Sending it to an image generator would be handing the second
 * factor to a third party in the act of setting it up. It never leaves the
 * page.
 *
 * WHY A LIBRARY. QR encoding is Reed–Solomon error correction over a specified
 * bit layout. A hand-rolled version that is subtly wrong produces a square that
 * looks exactly like a QR code and does not scan — a defect invisible to every
 * test that does not involve a camera. `qrcode-generator` is the long-standing
 * reference implementation, MIT, and has no dependencies of its own.
 *
 * ERROR CORRECTION LEVEL M, deliberately. `L` is smaller and gives up the
 * tolerance that lets a code survive a screen reflection or a smudged phone
 * lens; `H` inflates the module count for a payload that is short anyway. `M`
 * recovers about 15% and is what authenticator setup codes conventionally use.
 */
export function QrCode({
  value,
  title,
  className,
  size = 168,
}: {
  value: string;
  /** Read by assistive technology in place of the image. */
  title: string;
  className?: string;
  size?: number;
}) {
  const modules = useMemo(() => {
    // Type 0 lets the library pick the smallest version that fits.
    const code = qrcode(0, "M");
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    const rows: boolean[][] = [];
    for (let row = 0; row < count; row += 1) {
      const cells: boolean[] = [];
      for (let column = 0; column < count; column += 1) cells.push(code.isDark(row, column));
      rows.push(cells);
    }
    return rows;
  }, [value]);

  const count = modules.length;
  /*
   * The quiet zone is part of the specification, not padding for looks: a code
   * drawn flush to its container's edge fails to scan against a dark page,
   * because the scanner cannot find where the code stops. Four modules is the
   * specified minimum.
   */
  const quiet = 4;
  const span = count + quiet * 2;

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
    >
      {/*
        WHITE IS NOT DECORATION HERE. Scanners expect dark modules on a light
        field, and OCADE's dark theme would otherwise render this as dark-on-dark
        and simply not scan. The code carries its own background, in both themes.
      */}
      <rect width={span} height={span} fill="#ffffff" />
      {modules.map((row, rowIndex) =>
        row.map((dark, columnIndex) =>
          dark ? (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex + quiet}
              y={rowIndex + quiet}
              width={1}
              height={1}
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

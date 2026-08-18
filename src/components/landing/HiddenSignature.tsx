import "@/motion-upgrades.css";

/**
 * Deliberately difficult to notice: the entire mark is capped at 5% opacity.
 * It is decorative and excluded from the accessibility tree so screen readers
 * do not announce unexplained numbers while navigating the landing page.
 */
export function HiddenSignature() {
  return (
    <div className="ocade-hidden-signature" aria-hidden="true" data-hidden-signature="HAANS-44-28">
      <strong>HAANS</strong>
      <span>44</span>
      <span>28</span>
    </div>
  );
}

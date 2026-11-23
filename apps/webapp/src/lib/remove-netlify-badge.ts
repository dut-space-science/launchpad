/**
 * Removes the "Powered by Netlify" iframe that Netlify injects into the page.
 *
 * The iframe is added after load (and can be re-added), so removing it once is not enough: remove any that exist now,
 * then watch the document and remove each one as it appears. A CSS rule hides it in the gap before removal.
 */
const SELECTOR = 'iframe#nl-badge-frame[title="Powered by Netlify"]';

export function removeNetlifyBadge(): () => void {
  const style = document.createElement("style");
  style.textContent = `${SELECTOR}{display:none!important}`;
  document.head.append(style);

  const sweep = () => document.querySelectorAll(SELECTOR).forEach((el) => el.remove());
  sweep();

  const observer = new MutationObserver(sweep);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    style.remove();
  };
}

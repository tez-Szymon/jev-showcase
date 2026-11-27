import { normalize } from '../shared/model.js';
// LinkedIn's legacy feed and its newer SDUI feed use different attributes.
export const cardSelector =
  '[data-bs-post], [data-urn^="urn:li:activity:"], [data-id^="urn:li:activity:"], [data-view-name="feed-full-update"], .feed-shared-update-v2, .occludable-update, main [role="article"]';
export const textSelectors = [
  '[data-post-text]',
  '[data-testid="expandable-text-box"]',
  '[componentkey^="feed-commentary"]',
  '[data-test-id="main-feed-activity-card__commentary"]',
  '.feed-shared-update-v2__description',
  '.update-components-text',
  '.feed-shared-text',
  '[data-ad-preview="message"]',
];
const excluded =
  '[componentkey^="comment-"], [data-view-name*="comment-thread"], .comments-comment-item, .comments-comment-list, .comments-comment-entity, aside, nav, [role="dialog"]';
function bodyNodes(card: Element, selector: string): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>(selector)].filter(
    (node) => !node.closest(excluded),
  );
}
export function extract(card: Element): string {
  for (const selector of textSelectors) {
    for (const node of bodyNodes(card, selector)) {
      const copy = node.cloneNode(true) as HTMLElement;
      copy
        .querySelectorAll(
          'button, [aria-hidden="true"], script, style, linkedin-bs-meter, .bs-status',
        )
        .forEach((child) => child.remove());
      copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      const text = normalize(copy.textContent || '');
      if (text) return text.slice(0, 12000);
    }
  }
  // Never fall back to the entire card: that would include author and engagement data.
  const paragraphs = [
    ...card.querySelectorAll<HTMLElement>(':scope > p, :scope > [role="paragraph"]'),
  ];
  return normalize(paragraphs.map((p) => p.innerText || p.textContent).join('\n')).slice(0, 12000);
}
export function cards(root: ParentNode = document): HTMLElement[] {
  const candidates = new Set(root.querySelectorAll<HTMLElement>(cardSelector));
  // Start from recognizable prose so a generic list item cannot become a post by itself.
  // SDUI uses role=listitem and randomized classes, without the old feed-shared classes.
  for (const text of root.querySelectorAll<HTMLElement>(textSelectors.join(','))) {
    if (text.closest(excluded)) continue;
    const card =
      text.closest<HTMLElement>(cardSelector) ||
      text.closest<HTMLElement>('[role="listitem"], article') ||
      // Some SDUI variants expose only a keyed paragraph around the expandable body.
      // Use that narrow prose container rather than guessing a random class or whole feed.
      (text.matches('[data-testid="expandable-text-box"]') && text.closest('main, [role="main"]')
        ? text.closest<HTMLElement>('p[componentkey]')
        : null);
    if (card && card !== text) candidates.add(card);
  }
  const valid = [...candidates].filter((card) => !card.closest(excluded));
  return valid.filter((card) => !valid.some((parent) => parent !== card && parent.contains(card)));
}

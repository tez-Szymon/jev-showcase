export const genericSelectors = [
  'article h1',
  'article h2',
  'article h3',
  'main h2',
  'main h3',
  'a h2',
  'a h3',
  'h2 a',
  'h3 a',
  '[role="heading"]',
  'article a',
  'main a',
];
export function extract(selectors: string[]): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of selectors)
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (
        element.closest(
          'nav, footer, header, aside, [role="navigation"], [role="menu"], [data-headline-lens-ui]',
        )
      )
        continue;
      const node = element.querySelector<HTMLElement>('h1,h2,h3,h4,[role="heading"]') ?? element;
      if (node.matches('a') && node.querySelector('[data-headline-lens-processed]')) continue;
      const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (text.length < 24 || text.length > 240 || text.split(' ').length < 4) continue;
      if (/^(\d{1,2}:\d{2}|czytaj więcej|zobacz więcej|read more)/i.test(text)) continue;
      const anchor = node.closest('a') ?? node.querySelector('a');
      if (
        !anchor ||
        !/^https?:$/.test(anchor.protocol) ||
        !anchor.getAttribute('href') ||
        anchor.getAttribute('href')!.startsWith('#')
      )
        continue;
      // Bare links need article context or a repeated sibling card structure.
      const parent = node.parentElement;
      if (
        node.matches('a') &&
        !node.closest('article,[class*="card"],[class*="teaser"],[class*="news"],h1,h2,h3,h4') &&
        !(
          parent?.parentElement &&
          parent.parentElement.children.length >= 3 &&
          parent.children.length <= 5
        )
      )
        continue;
      candidates.add(node);
    }
  // Prefer the inner heading when selectors identify both a link and its heading.
  return [...candidates].filter(
    (node) => ![...candidates].some((other) => other !== node && node.contains(other)),
  );
}

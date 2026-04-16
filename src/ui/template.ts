import { t } from './i18n';

export interface ViewResult<T = Record<string, HTMLElement>> {
  element: HTMLElement;
  refs: T;
}

/**
 * Loads a template by ID, resolves recursive nesting via data-tpl,
 * applies translations, and collects references.
 */
export function view<T = Record<string, HTMLElement>>(templateId: string): ViewResult<T> {
  const template = document.getElementById(templateId) as HTMLTemplateElement;
  if (!template) {
    throw new Error(`Template "${templateId}" not found in document.`);
  }

  const fragment = template.content.cloneNode(true) as DocumentFragment;

  // 1. Resolve nested templates recursively
  resolveNesting(fragment);

  // 2. Process all nodes for translations and refs
  const refs = {} as any;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement;

    // Translation of content
    const tKey = el.getAttribute('data-t');
    if (tKey) {
      el.innerHTML = t(tKey);
    }

    // Translation of attributes
    if (el.hasAttribute('data-t-placeholder')) {
      el.setAttribute('placeholder', t(el.getAttribute('data-t-placeholder')!));
    }
    if (el.hasAttribute('data-t-title')) {
      el.setAttribute('title', t(el.getAttribute('data-t-title')!));
    }

    // Collect references
    const refKey = el.getAttribute('data-ref');
    if (refKey) {
      refs[refKey] = el;
    }
  }

  const element = fragment.firstElementChild as HTMLElement;
  return { element, refs };
}

/**
 * Recursively replaces elements having [data-tpl] with the content
 * of the referenced template.
 * Attributes on the placeholder are used to hydrate the nested template:
 * - data-ref-[name]="newName": Remaps an internal ref to a new name.
 * - data-t-[name]="key": Sets a translation key for an internal ref.
 * - Other data-* attributes are copied to the root of the nested template.
 */
function resolveNesting(parent: ParentNode) {
  let placeholder = parent.querySelector('[data-tpl]');
  
  while (placeholder) {
    const nestedId = placeholder.getAttribute('data-tpl')!;
    const nestedTpl = document.getElementById(nestedId) as HTMLTemplateElement;
    
    if (!nestedTpl) {
      throw new Error(`Nested template "${nestedId}" not found.`);
    }

    const nestedClone = nestedTpl.content.cloneNode(true) as DocumentFragment;
    const nestedRoot = nestedClone.firstElementChild as HTMLElement;

    if (nestedRoot) {
      for (const attr of Array.from(placeholder.attributes)) {
        if (attr.name === 'data-tpl') continue;

        if (attr.name.startsWith('data-ref-')) {
          // Remap internal ref: data-ref-action="myAction" -> finds data-ref="action" inside
          const targetRef = attr.name.slice(9);
          const targetEl = nestedClone.querySelector(`[data-ref="${targetRef}"]`);
          if (targetEl) targetEl.setAttribute('data-ref', attr.value);
        } else if (attr.name.startsWith('data-t-')) {
          // Pass translation key: data-t-label="my_key" -> finds data-ref="label" inside
          const targetRef = attr.name.slice(7);
          const targetEl = nestedClone.querySelector(`[data-ref="${targetRef}"]`);
          if (targetEl) targetEl.setAttribute('data-t', attr.value);
        } else {
          // Standard attribute inheritance to the nested root
          if (attr.name === 'class') {
            nestedRoot.classList.add(...attr.value.split(' '));
          } else {
            nestedRoot.setAttribute(attr.name, attr.value);
          }
        }
      }
    }

    // Replace placeholder with the cloned fragment
    placeholder.parentNode?.replaceChild(nestedClone, placeholder);

    // Look for next placeholder to handle recursive nesting
    placeholder = parent.querySelector('[data-tpl]');
  }
}

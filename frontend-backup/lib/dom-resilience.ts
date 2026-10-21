/**
 * Utility to make DOM operations resilient against external mutations
 * caused by browser translators (Google Translate, Chrome iOS, Safari Translate),
 * browser extensions, password managers, and webview injections.
 *
 * In React, when Google Translate or iOS Safari translates a page, it wraps or moves
 * text nodes into <font> elements. When React subsequently attempts to remove or insert
 * nodes during re-render, native removeChild/insertBefore throws:
 * "NotFoundError: The object can not be found here." (DOMException code 8)
 *
 * This patch intercepts these operations and handles mismatched parent/child relationships
 * gracefully without crashing the React application.
 */

export function setupDomResilience(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined' || !Node.prototype) {
    return;
  }

  // Avoid patching multiple times
  if ((window as any).__tati_dom_resilience_applied) {
    return;
  }
  (window as any).__tati_dom_resilience_applied = true;

  try {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          try {
            return child.parentNode.removeChild(child) as T;
          } catch {
            return child;
          }
        }
        return child;
      }
      try {
        return originalRemoveChild.call(this, child) as T;
      } catch (err: any) {
        // If it still throws NotFoundError (e.g. child was removed concurrently by translator)
        if (err && (err.name === 'NotFoundError' || err.code === 8)) {
          return child;
        }
        throw err;
      }
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (referenceNode.parentNode) {
          try {
            return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
          } catch {
            // Fallback to appendChild on this container
          }
        }
        try {
          return this.appendChild(newNode) as T;
        } catch {
          return newNode;
        }
      }
      try {
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
      } catch (err: any) {
        if (err && (err.name === 'NotFoundError' || err.code === 8)) {
          try {
            return this.appendChild(newNode) as T;
          } catch {
            return newNode;
          }
        }
        throw err;
      }
    };
  } catch (err) {
    console.warn('[DOM Resilience] Could not patch Node methods:', err);
  }
}

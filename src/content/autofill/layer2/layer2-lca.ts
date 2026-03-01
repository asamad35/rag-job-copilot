const buildAncestorChain = (element: Element): Element[] => {
  const chain: Element[] = []
  let current: Element | null = element

  while (current) {
    chain.push(current)
    current = current.parentElement
  }

  return chain
}

export const findLowestCommonAncestor = (
  left: Element,
  right: Element
): Element | null => {
  if (left === right) {
    return left
  }

  const rightAncestors = new Set(buildAncestorChain(right))

  for (const ancestor of buildAncestorChain(left)) {
    if (rightAncestors.has(ancestor)) {
      return ancestor
    }
  }

  return null
}

export const getDistanceToAncestor = (
  element: Element,
  ancestor: Element
): number => {
  if (element === ancestor) {
    return 0
  }

  let distance = 0
  let current: Element | null = element

  while (current && current !== ancestor) {
    current = current.parentElement
    distance += 1
  }

  return current === ancestor ? distance : Number.POSITIVE_INFINITY
}

export const getLcaDistance = (left: Element, right: Element): number => {
  const lca = findLowestCommonAncestor(left, right)

  if (!lca) {
    return Number.POSITIVE_INFINITY
  }

  const leftDistance = getDistanceToAncestor(left, lca)
  const rightDistance = getDistanceToAncestor(right, lca)

  if (!Number.isFinite(leftDistance) || !Number.isFinite(rightDistance)) {
    return Number.POSITIVE_INFINITY
  }

  return leftDistance + rightDistance
}

export const appearsBeforeInDom = (left: Element, right: Element): boolean => {
  const position = left.compareDocumentPosition(right)

  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

export const getAncestorElements = (element: HTMLElement): HTMLElement[] => {
  const ancestors: HTMLElement[] = []
  let current: HTMLElement | null = element

  while (current) {
    ancestors.push(current)
    current = current.parentElement
  }

  return ancestors
}

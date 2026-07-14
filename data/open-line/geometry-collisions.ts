import type { PathBounds, PathGeometryDiagnostics, PathGeometryNode, PathGeometryOptions } from "./geometry-types";

const collisionGap = 12;

function overlaps(left: PathBounds, right: PathBounds) {
  if (!left.width || !left.height || !right.width || !right.height) return false;
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function shifted(bounds: PathBounds, y: number): PathBounds {
  return { ...bounds, y: bounds.y + y };
}

function shiftNode(node: PathGeometryNode, y: number) {
  if (!y) return;
  node.point.y += y;
  node.bounds = shifted(node.bounds, y);
  node.labelBounds = shifted(node.labelBounds, y);
}

function mirroredLabel(node: PathGeometryNode, contentBounds: PathBounds, options: PathGeometryOptions) {
  if (!node.labelBounds.width || options.mode === "mobile") return node.labelBounds;
  const side = node.labelSide === "left" ? "right" : "left";
  const desiredX = side === "right" ? node.point.x + 32 : node.point.x - 32 - node.labelBounds.width;
  const x = Math.min(contentBounds.x + contentBounds.width - node.labelBounds.width, Math.max(contentBounds.x, desiredX));
  return { ...node.labelBounds, x };
}

function collisionType(left: PathGeometryNode, right: PathGeometryNode): PathGeometryDiagnostics["unresolvedCollisions"][number]["type"] | null {
  if (overlaps(left.bounds, right.bounds)) return "node";
  if (overlaps(left.labelBounds, right.labelBounds)) return "label";
  if (overlaps(left.bounds, right.labelBounds) || overlaps(left.labelBounds, right.bounds)) return "node_label";
  return null;
}

function requiredVerticalShift(previous: PathGeometryNode, current: PathGeometryNode) {
  const previousBottom = Math.max(previous.bounds.y + previous.bounds.height, previous.labelBounds.y + previous.labelBounds.height);
  const currentTop = Math.min(current.bounds.y, current.labelBounds.height ? current.labelBounds.y : current.bounds.y);
  return Math.max(0, previousBottom + collisionGap - currentTop);
}

function unresolved(nodes: readonly PathGeometryNode[], contentBounds: PathBounds) {
  const collisions: PathGeometryDiagnostics["unresolvedCollisions"] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    for (const [name, bounds] of [["node", node.bounds], ["label", node.labelBounds]] as const) {
      if (!bounds.width || !bounds.height) continue;
      if (bounds.x < contentBounds.x || bounds.y < contentBounds.y || bounds.x + bounds.width > contentBounds.x + contentBounds.width) {
        collisions.push({ type: "content_edge", ids: [node.id, name] });
      }
    }
    for (let previousIndex = Math.max(0, index - 10); previousIndex < index; previousIndex += 1) {
      const type = collisionType(nodes[previousIndex], node);
      if (type) collisions.push({ type, ids: [nodes[previousIndex].id, node.id] });
    }
  }
  return collisions;
}

export function resolveNodeCollisions(nodes: PathGeometryNode[], contentBounds: PathBounds, options: PathGeometryOptions) {
  let passes = 0;
  for (; passes < options.maximumLayoutPasses; passes += 1) {
    let changed = false;
    for (let index = 1; index < nodes.length; index += 1) {
      const current = nodes[index];
      const previousChronological = nodes[index - 1];
      const chronologicalShift = previousChronological.point.y + options.minimumNodeSpacing - current.point.y;
      if (chronologicalShift > 0) {
        shiftNode(current, chronologicalShift);
        changed = true;
      }
      for (let previousIndex = Math.max(0, index - 10); previousIndex < index; previousIndex += 1) {
        const previous = nodes[previousIndex];
        let type = collisionType(previous, current);
        if (type === "label" && options.mode !== "mobile" && current.labelBounds.width) {
          const candidate = mirroredLabel(current, contentBounds, options);
          const original = current.labelBounds;
          current.labelBounds = candidate;
          const mirroredType = collisionType(previous, current);
          if (!mirroredType) {
            current.labelSide = current.labelSide === "left" ? "right" : "left";
            changed = true;
            type = null;
          } else {
            current.labelBounds = original;
          }
        }
        if (!type) continue;
        const y = requiredVerticalShift(previous, current);
        if (y > 0) {
          shiftNode(current, y);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return { passes: Math.min(options.maximumLayoutPasses, passes + 1), unresolved: unresolved(nodes, contentBounds) };
}

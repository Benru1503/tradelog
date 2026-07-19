// Minimal XGBoost tree-dump evaluator. Walks the JSON produced by
// `booster.get_dump(dump_format="json")` in ml/train.py — no native
// runtime, no Python, just summed leaf values + a measured intercept.
//
// Two semantics matter for parity with XGBoost's own predictor:
//  1. Split comparisons happen in float32. XGBoost stores thresholds as
//     float32 and casts the feature value before comparing, so we apply
//     Math.fround to both sides. Skipping this can flip a branch when a
//     value lands within float32 epsilon of a threshold.
//  2. NaN means "missing" and follows the node's `missing` child, which is
//     how the trainer handles absent volume data (e.g. forex).
//
// Correctness is pinned by tests/unit/ml-xgboost.test.ts against golden
// margins/probabilities exported by the trainer from the real model.

export interface XgbNode {
  nodeid: number;
  // Interior nodes.
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: XgbNode[];
  // Leaves.
  leaf?: number;
}

export interface XgbModelFile {
  trees: XgbNode[];
}

/**
 * Score one tree for a feature row keyed by feature name.
 * NaN feature values route to the node's `missing` child.
 */
export function evalTree(root: XgbNode, features: Record<string, number>): number {
  let node = root;
  // Trees from the trainer are depth ≤ 3; the loop bound guards against a
  // malformed dump ever cycling.
  for (let hops = 0; hops < 64; hops++) {
    if (node.leaf !== undefined) return node.leaf;
    if (
      node.split === undefined ||
      node.split_condition === undefined ||
      node.yes === undefined ||
      node.no === undefined ||
      node.missing === undefined ||
      node.children === undefined
    ) {
      throw new Error(`malformed xgboost node ${node.nodeid}`);
    }
    const value = features[node.split];
    let target: number;
    if (value === undefined || Number.isNaN(value)) {
      target = node.missing;
    } else {
      target = Math.fround(value) < Math.fround(node.split_condition) ? node.yes : node.no;
    }
    const next = node.children.find((c) => c.nodeid === target);
    if (!next) throw new Error(`missing child ${target} under node ${node.nodeid}`);
    node = next;
  }
  throw new Error("xgboost tree exceeded max depth — corrupt dump?");
}

/** Raw additive margin: sum of leaf values across all trees (no intercept). */
export function evalMargin(trees: XgbNode[], features: Record<string, number>): number {
  let sum = 0;
  for (const tree of trees) sum += evalTree(tree, features);
  return sum;
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Probability of the positive class for a binary:logistic model. */
export function predictProbability(
  trees: XgbNode[],
  intercept: number,
  features: Record<string, number>,
): number {
  return sigmoid(evalMargin(trees, features) + intercept);
}

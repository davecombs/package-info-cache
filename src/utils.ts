/**
 * indicate if the given object is an array completely filled with strings.
 * If it has no items in it, that's okay, but it must at least be an array.
 */
import fs from 'fs-extra';

export function isStringArray(obj: unknown): obj is string[] {
  if (!obj || !Array.isArray(obj)) {
    return false;
  }

  if (obj.find((item) => typeof item !== 'string')) {
    return false;
  }

  return true;
}

export function isObject(obj: unknown): obj is object {
  return obj !== null && obj !== undefined && typeof obj === 'object';
}

export function isString(obj: unknown): obj is string {
  return typeof obj === 'string';
}

export function hasItemInList(list: unknown, propName: string): boolean {
  return getObjectProperty(list, propName) !== undefined;
}
/**
 * if an object exists and has an entry in 'dependencies', return true.
 * If not, return false;
 * @param obj - the object to be tested.
 */
export function hasDependency(obj: unknown, dependency: string): boolean {
  return hasItemInList(obj, 'dependencies.' + dependency);
}

/**
 * if an object exists and has an entry in 'devDependencies', return true.
 * If not, return false;
 * @param obj - the object to be tested.
 */
export function hasDevDependency(obj: unknown, dependency: string): boolean {
  return hasItemInList(obj, 'devDependencies.' + dependency);
}

/**
 * A simple type for the utility functions below
 */
export type NamedObj = {
  name?: string;
};

/**
 * Push an entry into an array. If the entry is already in the array,
 * move the entry to the end of the array (this is used when assembling
 * lists of addons in particular, as in ember-cli "last right wins").
 *
 * All this ensures:
 *   pushUnique([a1,a2,a3], a1)
 *   results in:
 *
 *   [a2, a3, a1]
 *
 * which results in the most "least surprising" addon ordering.
 * @param array - the existing array
 * @param entry - the entry to be added
 */
export function pushUnique<T>(array: T[], entry: T): void {
  const index = array.indexOf(entry);

  if (index > -1) {
    // found it - remove it and then push it on the end.
    array.splice(index, 1);
  }

  // At this point, the entry is not in the array. So we must append it.
  array.push(entry);
}

/**
 * Sort comparison function for two objects potentially with names (e.g. PackageInfo)
 * @param a - the first object
 * @param b - the second object
 * @returns a number. If equal names, 0. If a is first, -1. If b is first, +1.
 */
export function lexicographically(a: NamedObj, b: NamedObj): number {
  const aIsString = typeof a.name === 'string';
  const bIsString = typeof b.name === 'string';

  if (a.name && b.name && aIsString && bIsString) {
    return a.name.localeCompare(b.name);
  } else if (aIsString) {
    return -1;
  } else if (bIsString) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * Given something (not necessarily an object), and a nested property,
 * return the value of the nested property, or undefined. This is essentially
 * doing a TS-safe version of optional chaining where we think we know that
 * only objects are in the chain before the end.
 * @param obj - the thing to get a property from
 * @param prop - the name of the property (can be nested, separated by '.', like 'a.b.c')
 * note: we don't handle props starting with '.'.
 */
export function getObjectProperty(obj: unknown, prop: string): unknown {
  if (!isObject(obj) || !isString(prop)) {
    return undefined;
  }

  const props: string[] = prop.split('.');
  let currVal: unknown = obj;

  for (let i = 0; i < props.length; i++) {
    const record = currVal as Record<string, unknown>;
    const innerProp = props[i] as string;
    const val = record[innerProp];
    if (i < props.length - 1 && !isObject(val)) {
      return undefined;
    }

    // either we're at the end or we have an object
    currVal = val;
  }

  return currVal;
}

export function setObjectProperty(
  obj: unknown,
  prop: string,
  value: unknown
): boolean {
  if (!isObject(obj) || !isString(prop)) {
    return false;
  }

  const props: string[] = prop.split('.');
  let currVal: unknown = obj;

  for (let i = 0; i < props.length; i++) {
    const record = currVal as Record<string, unknown>;
    const innerProp = props[i] as string;
    if (i < props.length - 1) {
      let val = record[innerProp];
      if (val === undefined || val === null) {
        record[innerProp] = {};
        val = record[innerProp];
      } else if (!isObject(val)) {
        return false; // something already there, so can't overwrite it
      }

      currVal = val;
    } else {
      // i = props.length - 1;
      record[innerProp] = value;
    }
  }

  return true;
}

export class TreeNode {
  public path: string;
  public children: Array<TreeNode>;

  constructor(path: string) {
    this.path = path;
    this.children = [];
  }
}

export function buildTree(rootPath: string): TreeNode {
  const root = new TreeNode(rootPath);

  const stack = [root];

  while (stack.length) {
    const currentNode = stack.pop();

    if (currentNode) {
      const children = fs.readdirSync(currentNode.path);

      for (const child of children) {
        const childPath = `${currentNode.path}/${child}`;
        const childNode = new TreeNode(childPath);
        currentNode.children.push(childNode);

        if (fs.statSync(childNode.path).isDirectory()) {
          stack.push(childNode);
        }
      }
    }
  }

  return root;
}

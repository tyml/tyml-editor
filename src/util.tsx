
const keys = new Map<Object, string>();
export function getUniqueKeyFor(obj: Object, index: number) {
  if(typeof obj === "string") return "I"+index;
  if(!keys.has(obj)) {
    keys.set(obj, "@"+Math.random());
  }
  return keys.get(obj);
}
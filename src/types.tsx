import {isObservableArray} from 'mobx';

export type STRING = {$type: "string"};
export const STRING: STRING = {$type: "string"};
export type NOTSET = {$type: "not set"};
export const NOTSET: NOTSET = {$type: "not set"};
export type UnionType = {$type: "UnionType", name: string, alternatives: Type[]};

export type ObjectType = {$type: "ObjectType", name: string, attributes: {name: string, type: Type}[]};
export type ArrayType = {$type: "array", of: Type};
export type TypeDefinition = ObjectType | UnionType;
export type ResolvedType = TypeDefinition | ArrayType | STRING | NOTSET;
export type Type = string | ResolvedType;

const types: TypeDefinition[] = [
    {
        $type: "ObjectType",
        name: "FStab", 
        attributes: [
            {
                name: "entries",
                type: {$type: "array", of: "FStabEntry"}
            }
        ]
    },
    {
        $type: "ObjectType",
        name: "FStabEntry",
        attributes: [
            {name: "mountpoint", type: STRING},
            {name: "source", type: "FilesystemSource"},
        ]
    },
    {
        $type: "UnionType",
        name: "FilesystemSource",
        alternatives: ["BlockDevice", "tmpfs"]
    },
    {
        $type: "ObjectType",
        name: "BlockDevice",
        attributes: [
            {name: "identifier", type: "BlockDeviceIdentifier"},
            {name: "filesystem", type: STRING},
            {name: "options", type: {$type: "UnionType", name: "MaybeOptions", alternatives: [
                {$type: "array", of: STRING}, NOTSET
            ]}}
        ]
    },
    {
        $type: "UnionType",
        name: "BlockDeviceIdentifier",
        alternatives: ["UUID", "Path"]
    },
    {
        $type: "ObjectType",
        name: "Path",
        attributes: [{name: "Path", type: STRING}]
    },
    {
        $type: "ObjectType",
        name: "UUID",
        attributes: [{name: "UUID", type: STRING}]
    },
    {
        $type: "ObjectType", 
        name: "tmpfs",
        attributes: [
            {name: "options", type: {$type:"array", of: {
                $type: "UnionType",
                name: "Option",
                alternatives: [STRING, "size"]
            }}}
        ]
    },
    {
        $type: "ObjectType",
        name: "size",
        attributes: [
            {name: "size", type: STRING}
        ]
    }
];

export function resolve(t: Type): ResolvedType {
    if(typeof t !== "string") return t;
    const found = types.find(e => e.name === t);
    if(!found) throw Error(`could not find type ${t}`);
    return found;
}
export function typeToString(t: Type): string {
    if(typeof t === "string") return t;
    switch(t.$type) {
      case "ObjectType": return t.name;
      case "UnionType": return t.name;
      case "array": return `Array<${typeToString(t.of)}>`;
      case "string": return "String";
      case "not set": return "not set";
    }
}
export function instantiate(t: Type): any {
  if(typeof t === "string") return instantiate(resolve(t));
  switch(t.$type) {
    case "ObjectType": {
        const obj: any = {$type: t.name};
        for(const {name, type} of t.attributes) obj[name] = instantiate(type);
        return obj;
    }
    case "UnionType": return instantiate(t.alternatives[0]);
    case "array": return [];
    case "string": return "";
    case "not set": return undefined;
  }
}

export function isInstance(obj: any, t: Type): boolean {
    if(typeof t === "string") return isInstance(obj, resolve(t));
    switch(t.$type) {
      case "ObjectType": return obj.$type === t.name
      case "UnionType": return t.alternatives.some(type => isInstance(obj, type));
      case "array": return (Array.isArray(obj)|| isObservableArray(obj)) && obj.every((ele:any) => isInstance(ele, t.$type));
      case "string": return typeof obj === "string";
      case "not set": return obj === undefined;
    }
}


import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {observable, action, extendObservable, useStrict, isObservableArray} from 'mobx';
import {observer} from 'mobx-react';
import DevTools from 'mobx-react-devtools';
import 'whatwg-fetch';
useStrict(true);

type UnionType = {$type: "UnionType", name: string, alternatives: Type[]};
type ObjectType = {$type: "ObjectType", name: string, attributes: Attribute[]};
type TypeDefinition = ObjectType | UnionType;
type Type = TypeDefinition | string | {$type: "array", of: Type};
type Attribute = 
    {name: string, type: Type};

const STRING = "string";
const NOTSET = "not set";
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
            {name: "source", type: "FilesystemSource"},
            {name: "mountpoint", type: STRING}
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
                alternatives: ["string", "size"]
            }}}
        ]
    },
    {
        $type: "ObjectType",
        name: "size",
        attributes: [
            {name: "size", type: "string"}
        ]
    }
];
function resolve(name: string) {
    const found = types.find(e => e.name === name);
    if(!found) throw Error(`could not find type ${name}`);
    return found;
}
function typeToString(t: Type): string {
    if(typeof t === "string") return t;
    else if (t.$type === "ObjectType" || t.$type === "UnionType") return t.name;
    else if(t.$type === "array") return `Array<${typeToString(t.of)}>`;
    throw "unknown";
}
function instantiate(t: Type): any {
    if(t === NOTSET) return null;
    if(t === STRING) return "";
    if(typeof t === "string") return instantiate(resolve(t));
    else if (t.$type === "ObjectType") {
        const obj: any = {$type: t.name};
        for(const {name, type} of t.attributes) obj[name] = instantiate(type);
        return obj;
    }
    else if (t.$type === "array") {
        return [];
    }
    else if (t.$type === "UnionType") {
        return instantiate(t.alternatives[0]);
    }
}
interface Accessor<T> {
    get(): T;
    set(t: T): void;
}
function isInstance(obj: any, t: Type): boolean {
    if (t === STRING) return typeof obj === "string";
    if (t === NOTSET) return obj === undefined;
    if (typeof t === "string") return isInstance(obj, resolve(t));
    if (t.$type === "ObjectType") return obj.$type === t.name;
    if (t.$type === "UnionType") return t.alternatives.some(type => isInstance(obj, type));
    if (t.$type === "array") return (Array.isArray(obj)|| isObservableArray(obj)) && obj.every((ele:any) => isInstance(ele, t.$type));
    throw "unknown";
}
@observer
class ObjectEditor extends React.Component<{type: Type, value: Accessor<any>}, {}> {
    render(): JSX.Element {
        const {type, value} = this.props;
        console.log("editing", value.get(), "as", type);
        if (type === STRING) {
            return <StringEditor value={value} />;
        }
        if (type === NOTSET) {
            return <i>{NOTSET}</i>;
        }
        else if (typeof type === 'string') {
            return <ObjectEditor type={resolve(type)} value={value} />
        } else if (type.$type === "array") {
            return <ArrayEditor type={type} value={value} />;
        } else if (type.$type === "UnionType") {
            return <UnionEditor type={type} value={value} />;
        } else if(type.$type === "ObjectType") {
            return <ObjectTypeEditor type={type} value={value} />;
        }
        throw "unknown";
    }
}
const indent: React.CSSProperties = {
    paddingLeft: "1em"
}
@observer
class StringEditor extends React.Component<{value: Accessor<string>}, {}> {
    render() {
        return <input type="text" value={this.props.value.get()} onChange={c => this.props.value.set(c.currentTarget.value)} />;
    }
}
@observer
class ArrayEditor extends React.Component<{type: {$type: "array", of: Type}, value:  Accessor<any[]>}, {}> {
    add = action("ArrayEditor.add", () => this.props.value.get().push(instantiate(this.props.type.of)));
    remove = action("ArrayEditor.remove", () => this.props.value.get().pop());

    render() {
        const {type, value} = this.props;
        console.log("render");
        return (
            <div style={indent}>
            <button onClick={this.add}>+</button>
                <button onClick={this.remove}>-</button>
                {value.get().map((_,i) => <ObjectEditor key={i} type={type.of} value={{get: () => value.get()[i], set: v => value.get()[i] = v}} />)}
            </div>
        );
    }
}
@observer
class UnionEditor extends React.Component<{type: UnionType, value: Accessor<any>}, {}> {
    @observable currentlySelected = 0;
    constructor(props: {type:UnionType, value: any}) {
        super(props);
        this.findCurrent();
    }
    @action
    findCurrent() {
        const inx = this.props.type.alternatives.findIndex(type => isInstance(this.props.value.get(), type));
        if(inx === -1) {
            console.error(this.props.value.get(), "not instanceof", typeToString(this.props.type));
            throw Error("above");
        }
        this.currentlySelected = inx;
    }
    @action
    switchTo(i: number) {
        console.log("switching to "+i);
        this.currentlySelected = i;
        this.props.value.set(instantiate(this.props.type.alternatives[i]));
    }
    render() {
        const {type, value} = this.props;
        return (
            <div style={indent} >
                <h2>{type.name}</h2>
                Choose:
                <select onChange={v => this.switchTo(+v.currentTarget.value)} value={this.currentlySelected}>{type.alternatives.map((t,i) =>
                    <option key={i} value={i}>{typeToString(t)}</option>)}
                </select>
                <ObjectEditor type={type.alternatives[this.currentlySelected]} value={value} />
            </div>
        );
    }
}
@observer
class ObjectTypeEditor extends React.Component<{type: ObjectType, value: Accessor<any>}, {}> {
    render() {
        const {type, value} = this.props;
        return (
            <div style={indent}>
                <h2>{type.name}</h2>
                {type.attributes.map(attribute =>
                    <div key={attribute.name}>
                        <h3>{attribute.name}:</h3>
                        <ObjectEditor type={attribute.type} value={{get: () => value.get()[attribute.name], set: x => extendObservable(value.get(), {[attribute.name]: x})}} />
                    </div>
                )}
            </div>
        )
    }
}
let value: any;

const DisplayJSON = observer((props: {value: Accessor<any>}) =>
    <div style={{marginLeft: "auto", border: "1px solid black"}}><pre>{JSON.stringify(props.value.get(), null, 3)}</pre></div>
);
@observer
class GUI extends React.Component<{type: Type, value: Accessor<any>}, {}> {
    render() {
        const {type, value} = this.props;
        return (
            <div style={{display: "flex"}}>
                <ObjectEditor type={type} value={value} />
                <DisplayJSON value={value} />
                <DevTools />
            </div>
        )
    }
}
fetch("data/fstab.tyml.json").then(x => x.json()).then(val => {
    value = observable(val);
    Object.assign(window, {value});
    ReactDOM.render(<GUI type="FStab" value={{get: () => value, set: v => value = v}} />, document.getElementById('root'))
});


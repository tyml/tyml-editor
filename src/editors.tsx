import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {observable, action, extendObservable, useStrict, isObservableArray} from 'mobx';
useStrict(true);
import {observer} from 'mobx-react';
import DevTools from 'mobx-react-devtools';
import 'whatwg-fetch';
import { Card, CardTitle, CardText, CardActions, CardMedia } from 'react-toolbox/lib/card';
import { Button } from 'react-toolbox/lib/button';
import * as RT from 'react-toolbox';
import { Table } from 'react-toolbox/lib/table';
import 'react-toolbox/lib/commons.scss';

import * as ColorPicker from 'rc-color-picker';
import {ResolvedType, Type, ArrayType, ObjectType, typeToString, instantiate, UnionType, isInstance, STRING, NOTSET, resolve} from './types';
import * as util from './util';

type Attribute = 
    {$type: "Attribute", name: string, type: Type};
type ArrayIndex = {$type: "ArrayIndex", index: number, array: ArrayType}; 
type Editable = ResolvedType | Attribute | ArrayIndex;
enum EditorKind {
    Inline, Block
}
interface EditorProps {
    editable: Editable, value: Accessor<any>
}
interface Editor {
    kind: EditorKind;
    // return priority
    canEdit: (thing: Editable) => false | number;
    new (props?: EditorProps, context?: any): React.Component<EditorProps, {}>;
}


export interface Accessor<T> {
    get(): T;
    set(t: T): void;
}
function ArrayAccessor<T>(arr: Accessor<Array<T>>, i: number): Accessor<T> {
    return {get: () => arr.get()[i], set: v => arr.get()[i] = v};
}
function ObjectAccessor(acc: Accessor<any>, attr: string): Accessor<any> {
    const obj = acc.get();
    if(!obj.hasOwnProperty(attr)) extendObservable(obj, {[attr]: undefined});
    return {get: () => obj[attr], set: x => obj[attr] = x};
}

const flexLabel = {flex:"1 1 fit-content", alignSelf:"center", marginRight: "1em", paddingTop:"1ex"};

@observer
class StringEditor extends React.Component<{editable: STRING, value: Accessor<string>, label?: string}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (e: Editable) => e.$type === "string" && 1;

    onChange = action("StringEditor.onChange", (text: string) => this.props.value.set(text));
    render() {
        const str = this.props.value.get();
        const regex = this.props.editable.regex;
        let error: string | undefined = undefined;
        if(regex && !regex.test(str)) error = "Invalid "+this.props.label+": Regex does not match.";
        return <RT.Input type="text" label={this.props.label} error={error}
            value={str} onChange={this.onChange} />;
    }
}
@observer
class UndefinedEditor extends React.Component<{editable: NOTSET, value: Accessor<undefined>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (e: Editable) => e.$type === "not set" && 1;

    render() {
        return <i/>;
    }
}
@observer
class ArrayElementEditor extends React.Component<{editable: ArrayIndex, value: Accessor<any[]>}, {}> {
    static kind = EditorKind.Block;
    static canEdit = (e: Editable) => e.$type === "ArrayIndex" && 1;
    remove = action("ArrayElementEditor.remove", () => this.props.value.get().splice(this.props.editable.index, 1));
    render() {
        const {editable, value} = this.props;
        const i = editable.index;
        return (
            <Card raised style={{margin: "1em"}}>
                <CardText>
                    <h5>
                        {i+1}. {typeToString(editable.array.of)}
                        <RT.Button icon="remove" onClick={this.remove} style={{float:"right"}} floating accent mini/>
                    </h5>
                    <AutoEditor key={i} editable={editable.array.of} value={ArrayAccessor(value, i)} />
                </CardText>
            </Card>
        )
    }
}
@observer
class ArrayElementInlineEditor extends React.Component<{editable: ArrayIndex, value: Accessor<any[]>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (e: Editable) => e.$type === "ArrayIndex" && chooseEditor(e.array.of, EditorKind.Inline) !== EditorError && 2;
    remove = action("ArrayElementEditor.remove", () => this.props.value.get().splice(this.props.editable.index, 1));
    render() {
        const {editable, value} = this.props;
        const i = editable.index;
        return (
            <div style={{display: "flex"}}>
                <div style={flexLabel}>
                    {(i+1)}. {typeToString(editable.array.of)}: 
                </div>
                <div style={{flex:1}}>
                    <AutoEditor key={i} editable={editable.array.of} value={ArrayAccessor(value, i)} />
                </div>
                <div style={flexLabel}>
                    <Button icon="remove" onClick={this.remove} floating accent mini /> 
                </div>
            </div>
        )
    }
}
@observer
class ArrayEditor extends React.Component<{editable: ArrayType, value:  Accessor<any[]>}, {}> {
    static kind = EditorKind.Block;
    static canEdit = (type: Editable) => type.$type === "array" && 1;

    add = action("ArrayEditor.add", () => this.props.value.get().push(instantiate(this.props.editable.of)));
    render() {
        const {editable, value} = this.props;
        console.log("render");
        return (
            <div>
                {value.get().map((e,i) =>
                    <AutoEditor key={util.getUniqueKeyFor(e, i)} editable={{$type: "ArrayIndex", index: i, array: editable}} value={value} />
                )}
                <Button style={{marginTop: "1em"}} onClick={this.add} icon="add" label={`Add ${typeToString(editable.of)}`} raised primary />
            </div>
        );
    }
}

@observer
class DateEditor extends React.Component<{editable: ObjectType, value: Accessor<{value: string}>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable) => type.$type === "ObjectType" && type.name === "Date" && 3;
    handleChange = action("DateEditor.handleChange", (v: Date) => {
        const d = new Date(v.getTime() - v.getTimezoneOffset()*60*1000).toISOString();
        this.props.value.get().value = d.substring(0, 10);
    });
    render() {
        let date = this.props.value.get().value;
        if(date) date = date + "T00:00:00.000Z";
        return <RT.DatePicker label='Date' onChange={this.handleChange} value={date?new Date(date): undefined} />;
    }
}
@observer
class DateTimeEditor extends React.Component<{editable: ObjectType, value: Accessor<{value: string}>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable) => type.$type === "ObjectType" && type.name === "DateTime" && 3;
    handleDateChange = action("DateTimeEditor.handleDateChange", (v: Date) => {
        const target = this.props.value.get();
        const date = target.value ? new Date(target.value): new Date(Date.UTC(2016, 1, 1));
        date.setFullYear(v.getFullYear());
        date.setMonth(v.getMonth());
        date.setDate(v.getDate());
        target.value = date.toISOString();
    });
    handleTimeChange = action("DateTimeEditor.handleTimeChange", (v: Date) => {
        const target = this.props.value.get();
        const date = target.value ? new Date(target.value): new Date(Date.UTC(2016, 1, 1));
        date.setHours(v.getHours());
        date.setMinutes(v.getMinutes());
        target.value = date.toISOString();
    });
    render() {
        let date = this.props.value.get().value;
        return <div style={{display:"flex"}}>
            <RT.DatePicker style={{flex: 1}} label='Date' onChange={this.handleDateChange} value={date?new Date(date): undefined} />
            <div style={{flex: 1}}><RT.TimePicker label='Time' onChange={this.handleTimeChange} value={date?new Date(date): undefined} /></div>
        </div>
    }
}
@observer
class ColorEditor extends React.Component<{editable: ObjectType, value: Accessor<{value: string}>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable) => type.$type === "ObjectType" && type.name === "Color" && 3;
    handleChange = action("ColorPicker.handleChange", (v: any) => {
        this.props.value.get().value = v.color;
    });
    render() {
        return <ColorPicker animation="slide-up" color={this.props.value.get().value} onChange={this.handleChange} />;
    }
}
@observer
class TimeEditor extends React.Component<{editable: ObjectType, value: Accessor<{value: string}>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable) => type.$type === "ObjectType" && type.name === "Time" && 3;
    handleChange = action("TimeEditor.handleChange", (v: Date) => {
        const d = new Date(v.getTime() - v.getTimezoneOffset()*60*1000).toISOString();
        this.props.value.get().value = d.substring(11, 16);
    });
    render() {
        let time = this.props.value.get().value;
        let date: Date | undefined;
        if(time) {
            date = new Date();
            date.setHours(+time.substr(0, 2));
            date.setMinutes(+time.substr(3, 5));
        }
        return <RT.TimePicker label='Time' onChange={this.handleChange} value={date} />;
    }
}
@observer
class GuidEditor extends React.Component<{editable: ObjectType, value: Accessor<{value: string}>}, {}> {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable) => type.$type === "ObjectType" && type.name === "GUID" && 3;
    handleChange = action("GuidEditor.handleChange", (v: any) => {
        this.props.value.get().value = v;
    });
    render() {
        const s = this.props.editable.attributes[0].type as STRING;
        return (
            <div style={{display:"flex"}}>
                <Button style={{flex:"1 1 fit-content", alignSelf:"center", marginRight: "1em"}} onClick={() => this.handleChange(util.generateGUID())} label={`Generate`} raised primary />
                <div style={{flex: "1"}}>
                    <StringEditor editable={s} value={ObjectAccessor(this.props.value, "value")} label="GUID" />
                </div>
            </div>
        );
    }
}


abstract class UnionEditor extends React.Component<{editable: UnionType, value: Accessor<any>}, {}> {
    @observable currentlySelected = 0;
    constructor(props: any) {
        super(props);
        this.findCurrent();
    }
    @action
    findCurrent() {
        const inx = this.props.editable.alternatives.findIndex(type => isInstance(this.props.value.get(), type));
        if(inx === -1) {
            console.error(this.props.value.get(), "not instanceof", typeToString(this.props.editable));
            throw Error("above");
        }
        this.currentlySelected = inx;
    }
    @action
    switchTo(i: number) {
        console.log("switching to "+i);
        this.currentlySelected = i;
        this.props.value.set(instantiate(this.props.editable.alternatives[i]));
    }
}
@observer
class UnionBlockEditor extends UnionEditor {
    static kind = EditorKind.Block;
    static canEdit = (type: Editable) => type.$type === "UnionType" && 1;
    customItem = (p: ({value: number, label: string})) => {
        return <h5>{p.label}</h5>;
    }
    render() {
        const {editable, value} = this.props;
        const alternatives = editable.alternatives.map((t,i) => ({value: i, label: typeToString(t)}));
        return (
            <Card raised>
                <CardText>
                 <RT.Dropdown auto label={`Choose a type for ${editable.name}`} onChange={(v:number) => this.switchTo(+v)} value={this.currentlySelected} source={alternatives}
                        template={this.customItem}
                    />
                    <AutoEditor editable={editable.alternatives[this.currentlySelected]} value={value} />
                </CardText>
            </Card>
        );
    }
}
@observer
class UnionInlineEditor extends UnionEditor {
    static kind = EditorKind.Inline;
    static canEdit = (type: Editable): false|number => {
        if(type.$type !== "UnionType") return false;
        return type.alternatives.every(type => chooseEditor(type, EditorKind.Inline) !== EditorError) && 2;
    }
    render() {
        const {editable, value} = this.props;
        const alternatives = editable.alternatives.map((t,i) => ({value: i, label: typeToString(t)}));
        return (
            <div style={{display: "flex"}}>
                <RT.Dropdown auto
                    style={flexLabel}
                    label={`${editable.name}`}
                    onChange={(v:number) => this.switchTo(+v)}
                    value={this.currentlySelected}
                    source={alternatives}/>
                <div style={{flex:"1"}}><AutoEditor editable={editable.alternatives[this.currentlySelected]} value={value} /></div>
            </div>
        );
    }
}
@observer
class ObjectAttributeEditor extends React.Component<{editable: Attribute, value: Accessor<any>}, {}> {
    render() {
        const {editable, value} = this.props;
        const Editor = chooseEditor(editable.type);
        if(Editor.kind === EditorKind.Block) return (
            <div>
                <b>{editable.name}:</b>
                <div style={{margin:"1em"}}><AutoEditor editable={editable.type} value={ObjectAccessor(value, editable.name)} /></div>
            </div>
        ); else return (
            <div style={{display:"flex"}}>
                <b style={flexLabel}>{editable.name}: </b>
                <div style={{flex:"1"}}><AutoEditor editable={editable.type} value={ObjectAccessor(value, editable.name)} /></div>
            </div>
        );
    }
}
@observer
class ObjectEditor extends React.Component<{editable: ObjectType, value: Accessor<any>}, {}> {
    static canEdit = (type: Editable) => type.$type === "ObjectType" && 1;
    static kind = EditorKind.Block;
    render() {
        const {editable, value} = this.props;
        return (
            <div>
            {editable.attributes.map(attribute => <ObjectAttributeEditor key={attribute.name} editable={{$type: "Attribute", name: attribute.name, type: attribute.type}} value={value} />)}
            </div>
        )
    }
}


@observer
class SimpleObjectInlineEditor extends React.Component<{editable: ObjectType, value: Accessor<any>}, {}> {
    static canEdit(type: ResolvedType): false|number {
        if(type.$type !== "ObjectType") return false;
        if(type.attributes.length !== 1) return false;
        if(!isInstance("yolo", type.attributes[0].type)) return false;
        return 2;
    }
    static class = SimpleObjectInlineEditor;
    static kind = EditorKind.Inline;
    render() {
        const {editable, value} = this.props;
        const {name, type} = editable.attributes[0];
        const typeAsString = type as STRING; //don't move, VSCode highlighting bug
        return (
            <StringEditor editable={typeAsString} value={ObjectAccessor(value, name)} label={name} />
        )
    }
}


@observer
class EditorError extends React.Component<{editable: Editable, value: Accessor<any>}, {}> {
    static canEdit = (e: Editable) => 0.1;
    static kind = EditorKind.Inline;

    render() {
        return (
            <div>Error: Could not find Editor for {JSON.stringify(this.props.editable)}</div>
        )
    }
}

const knownEditors: Editor[] = [
  ObjectEditor, SimpleObjectInlineEditor, UnionBlockEditor, UnionInlineEditor,
  ArrayEditor, StringEditor, UndefinedEditor, EditorError, ArrayElementEditor, ArrayElementInlineEditor,
  DateEditor, DateTimeEditor, TimeEditor, ColorEditor, GuidEditor
]

function chooseEditor(type: Editable | Type, kind?: EditorKind): Editor {
    if(typeof type === "string") return chooseEditor(resolve(type), kind);
    const editors:{editor: Editor, priority: number}[] = [];
    for(const editor of knownEditors) {
        if(kind !== undefined && editor.kind !== kind) continue;
        const priority = editor.canEdit(type);
        if(priority === false) continue;
        editors.push({editor, priority});
    }
    editors.sort((a,b) => b.priority - a.priority);
    if((type as any).name === "Path") console.log(editors);
    //console.log("chooseEditor", typeToString(type), kind===undefined || EditorKind[kind], "=", editors[0] && editors[0].editor);
    return editors[0].editor;
}
@observer
export class AutoEditor extends React.Component<{editable: Editable | Type, value: Accessor<any>}, {}> {
    render(): JSX.Element {
        let {editable, value} = this.props;
        if(typeof editable === "string") editable = resolve(editable);
        const Editor = chooseEditor(editable);
        return <Editor editable={editable} value={value} />;
    }
}
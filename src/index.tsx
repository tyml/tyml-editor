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

import {Type, typeToString} from './types';
import {Accessor, AutoEditor} from './editors';


const indent: React.CSSProperties = {
    paddingLeft: "1em"
}

const DisplayJSON = observer((props: {value: Accessor<any>}) =>
    <div style={{marginLeft: "auto", border: "1px solid black"}}>
        <pre>{JSON.stringify(props.value.get(), null, 3)}</pre>
    </div>
);
@observer
class GUI extends React.Component<{type: Type, value: Accessor<any>}, {}> {
    render() {
        const {type, value} = this.props;
        return (
            <div style={{maxWidth: "1200px"}}>
                <div style={{display:"flex"}}>
                    <Card>
                        <CardTitle title={"Editing "+typeToString(type)} />
                        <CardText><AutoEditor editable={type} value={value} /></CardText>
                    </Card>
                    <DisplayJSON value={value} />
                    <DevTools />
                </div>
            </div>
        )
    }
}
fetch("data/fstab.tyml.json").then(x => x.json()).then(val => {
    const value: any = observable(val);
    const w = window as any;
    w.value = value;
    ReactDOM.render(<GUI type={value.$type} value={{get: () => w.value, set: x => w.value = x}} />, document.getElementById('root'))
});
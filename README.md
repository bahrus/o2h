# o2h

Converts JavaScript Object into canonical HTML.

```JavaScript
const object = {
    stringProp: 'string',
    numberProp: 1,
    booleanProp: true,
    subObject: {
        stringProp2: 'string2',
        numberProp2: 2,
        booleanProp2: false,
    },
    arrayProp: [
        'string',
        1,
        true,
        {
            stringProp3: 'string3',
            numberProp3: 3,
            booleanProp3: false,
        },
    ],
};

const {o2h} = await import('o2h/o2h.js');
o2h(object, console.log);
```

Outputs:

```html
<form>
    <label>
        stringProp
        <input value=string>
    </label>
    <label>
        numberProp
        <input type=number value=1>
    </label>
    <label>
        booleanProp
        <input type=checkbox checked>
    </label>
    <details>
        <summary>subObject</summary>
        <label>
            stringProp2
            <input value=string2>
        </label>
        <label>
            numberProp2
            <input type=number value=2>
        </label>
        <label>
            booleanProp2
            <input type=checkbox>
        </label>
    </details>
    <details>
        <summary>arrayProp</summary>
        <label>
            0
            <input value=string>
        </label>
        <label>
            1
            <input type=number value=1>
        </label>
        <label>
            2
            <input type=checkbox checked>
        </label>
        <details>
            <summary>3</summary>
            <label>
                stringProp3
                <input value=string3>
            </label>
            <label>
                numberProp3
                <input type=number value=3>
            </label>
            <label>
                booleanProp3
                <input type=checkbox>
            </label>
        </details>
    </details>
</form>
```
type strOrObjArr = (string | object)[];

export interface O2HConfig {
    wrapper: strOrObjArr,
    objectProp: strOrObjArr,
    stringProp: strOrObjArr,
    numberProp: strOrObjArr,
    dateProp: string, 
    booleanProp: string,
    arrayProp: string,
    arraySummaryPath?: string,
    pathOverrides?: {[key: string]: O2HConfig},
    objMatchOverrides?: [{ //TODO
        ifAllOf: string[],
        then: O2HConfig
    }],
    strMatchOverrides?: [{ //TODO
        regExp: string | RegExp,
        then: O2HConfig // based on captured groups
    }],
    makeStringPropLabelTitleCase: boolean,
    makeObjectPropLabelTitleCase: boolean,
    makeNumberPropLabelTitleCase: boolean,
    makeBooleanPropLabelTitleCase: boolean,
    makeArrayPropLabelTitleCase: boolean,
}
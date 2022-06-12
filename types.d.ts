type strOrObjArr = (string | object)[];

export interface O2HConfig {
    wrapper: strOrObjArr;
    objectProp: string[];
    stringProp: string;
    numberProp: string;
    dateProp: string; 
    booleanProp: string;
    arrayProp: string;
    arraySummaryPath?: string;
    pathOverrides?: {[key: string]: O2HConfig};
    objMatchOverrides?: [{ //TODO
        ifAllOf: string[],
        then: O2HConfig
    }],
    strMatchOverrides?: [{ //TODO
        regExp: string | RegExp,
        then: O2HConfig // based on captured groups
    }],
}
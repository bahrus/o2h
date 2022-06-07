import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapper: [string, string];
    objectProp: string[];
    stringProp: string;
    numberProp: string;
    dateProp: string; 
    booleanProp: string;
    arrayProp: string;
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
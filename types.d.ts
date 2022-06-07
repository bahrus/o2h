import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapper: [string, string];
    objectProp: string[];
    stringProp: string;
    stringPropValue: string;
    numberProp: string;
    numberPropValue: string;
    datePropOpen: string; 
    datePropValue: string;
    datePropClose: string;
    booleanProp: string;
    arrayProp: string;
    arraySummaryPath: string;
    arrayItemOpen: string;
    arrayItemClose: string;
    rootConfig?: O2HConfig;
    pathOverrides?: {[key: string]: O2HConfig};
    objMatchOverrides?: [{ //TODO
        ifAllOf: string[],
        then: O2HConfig
    }]
}
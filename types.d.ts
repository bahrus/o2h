import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapper: [string, string];
    objectProp: string[];
    objectPropBeProps: MayItBe; 
    stringProp: string;
    stringPropBeProps: MayItBe; 
    stringPropValue: string;
    numberProp: string;
    numberPropBeProps: MayItBe; 
    numberPropValue: string;
    datePropOpen: string; 
    datePropBeProps: MayItBe; 
    datePropValue: string;
    datePropClose: string;
    booleanProp: string;
    booleanPropBeProps: MayItBe; 
    arrayProp: string;
    arraySummaryPath: string;
    arrayPropBeProps: MayItBe; 
    arrayItemOpen: string;
    arrayItemClose: string;
    rootConfig?: O2HConfig;
    pathOverrides?: {[key: string]: O2HConfig};//WIP
}
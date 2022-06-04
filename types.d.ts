import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapper: [string, string];
    objectProp: string[];
    objectPropBeProps: MayItBe; 
    stringProp: [string, string];
    stringPropBeProps: MayItBe; 
    stringPropValue: string;
    numberPropOpen: string;
    numberPropBeProps: MayItBe; 
    numberPropValue: string;
    numberPropClose: string;
    datePropOpen: string; 
    datePropBeProps: MayItBe; 
    datePropValue: string;
    datePropClose: string;
    booleanPropOpen: string;
    booleanPropBeProps: MayItBe; 
    booleanPropValue: string;
    booleanPropClose: string;
    arrayPropOpen: string;
    arraySummaryPath: string;
    arrayPropBeProps: MayItBe; 
    arrayPropClose: string;
    arrayItemOpen: string;
    arrayItemClose: string;
    rootConfig?: O2HConfig;
    pathOverrides?: {[key: string]: O2HConfig};//WIP
}
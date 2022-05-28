import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapperOpen: string;
    wrapperClose: string;
    objectPropOpen: string;
    objectPropBeProps: MayItBe; 
    objectPropClose: string;
    stringPropOpen: string;
    stringPropBeProps: MayItBe; 
    stringPropValue: string;
    stringPropClose: string;
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
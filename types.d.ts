import {MayItBe} from 'may-it-be/types';

export interface O2HConfig {
    wrapperOpen: string;
    wrapperClose: string;
    objectPropOpen: string;
    objectPropBeProps: MayItBe; //TODO
    objectPropClose: string;
    stringPropOpen: string;
    stringPropBeProps: MayItBe; //TODO
    stringPropValue: string;
    stringPropClose: string;
    numberPropOpen: string;
    numberPropBeProps: MayItBe; //TODO
    numberPropValue: string;
    numberPropClose: string;
    datePropOpen: string; //TODO
    datePropBeProps: MayItBe; //TODO
    datePropValue: string;
    datePropClose: string;
    booleanPropOpen: string;
    booleanPropBeProps: MayItBe; //TODO
    booleanPropValue: string;
    booleanPropClose: string;
    arrayPropOpen: string;
    arrayPropBeProps: MayItBe; //TODO
    arrayPropClose: string;
    arrayItemOpen: string;
    arrayItemClose: string;
    rootConfig?: O2HConfig;
    pathOverrides?: {[key: string]: O2HConfig};//TODO
}
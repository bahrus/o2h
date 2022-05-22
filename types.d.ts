export interface O2HConfig {
    wrapperOpen: string;
    wrapperClose: string;
    objectPropOpen: string;
    objectPropClose: string;
    stringPropOpen: string;
    stringPropValue: string;
    stringPropClose: string;
    numberPropOpen: string;
    numberPropValue: string;
    numberPropClose: string;
    booleanPropOpen: string;
    booleanPropValue: string;
    booleanPropClose: string;
    arrayPropOpen: string;
    arrayPropClose: string;
    arrayItemOpen: string;
    arrayItemClose: string;
    rootConfig?: O2HConfig;
}